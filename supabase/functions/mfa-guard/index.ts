// MFA guard: rate limiting for verify attempts + recovery-code login for the Zaago dairy app.
// Scoped by app_key='zaago_dairy' so sibling apps sharing this Supabase project are unaffected.
import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_KEY = 'zaago_dairy';
const MAX_FAILURES = 5;
const WINDOW_MINUTES = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    // Shared: compute current lockout window
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    const getRecentFailures = async () => {
      const { data, error } = await admin
        .from('mfa_verification_attempts')
        .select('attempted_at, success')
        .eq('user_id', userId)
        .eq('app_key', APP_KEY)
        .gte('attempted_at', windowStart)
        .order('attempted_at', { ascending: false });
      if (error) throw error;
      // failures since the most recent success (or all in window if no success)
      const failures: string[] = [];
      for (const row of data ?? []) {
        if (row.success) break;
        failures.push(row.attempted_at as string);
      }
      return failures;
    };

    if (action === 'check_lockout') {
      const failures = await getRecentFailures();
      if (failures.length >= MAX_FAILURES) {
        const oldest = new Date(failures[failures.length - 1]).getTime();
        const retryAt = oldest + WINDOW_MINUTES * 60_000;
        return json({
          locked: true,
          retry_at: new Date(retryAt).toISOString(),
          retry_after_seconds: Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)),
        });
      }
      return json({ locked: false, remaining_attempts: MAX_FAILURES - failures.length });
    }

    if (action === 'record_attempt') {
      const success = Boolean(body?.success);
      const context = String(body?.context ?? 'mfa_verify').slice(0, 64);
      const { error } = await admin.from('mfa_verification_attempts').insert({
        user_id: userId,
        context,
        success,
        app_key: APP_KEY,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'recovery_login') {
      // Check lockout first
      const failures = await getRecentFailures();
      if (failures.length >= MAX_FAILURES) {
        const oldest = new Date(failures[failures.length - 1]).getTime();
        const retryAt = oldest + WINDOW_MINUTES * 60_000;
        return json({
          locked: true,
          retry_after_seconds: Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)),
        }, 429);
      }

      const rawCode = String(body?.code ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
      if (!/^[A-Z0-9]{8,20}$/.test(rawCode)) {
        await admin.from('mfa_verification_attempts').insert({
          user_id: userId, context: 'recovery_login', success: false, app_key: APP_KEY,
        });
        return json({ error: 'Invalid recovery code format' }, 400);
      }

      const codeHash = await sha256Hex(rawCode);
      const { data: match, error: matchErr } = await admin
        .from('user_recovery_codes')
        .select('id, used_at')
        .eq('user_id', userId)
        .eq('app_key', APP_KEY)
        .eq('code_hash', codeHash)
        .maybeSingle();

      if (matchErr) throw matchErr;

      if (!match || match.used_at) {
        await admin.from('mfa_verification_attempts').insert({
          user_id: userId, context: 'recovery_login', success: false, app_key: APP_KEY,
        });
        return json({ error: 'Invalid or already-used recovery code' }, 400);
      }

      // Mark used
      const { error: usedErr } = await admin
        .from('user_recovery_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', match.id);
      if (usedErr) throw usedErr;

      // Unenroll all TOTP factors so the session becomes AAL2-compatible again.
      // The user will be prompted to re-enable 2FA after logging in.
      const { data: factorsData, error: factorsErr } = await admin.auth.admin.mfa.listFactors({
        userId,
      });
      if (factorsErr) throw factorsErr;
      const totpFactors = (factorsData?.factors ?? []).filter((f) => f.factor_type === 'totp');
      for (const f of totpFactors) {
        await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
      }

      // Delete remaining recovery codes since the TOTP factor is gone
      await admin
        .from('user_recovery_codes')
        .delete()
        .eq('user_id', userId)
        .eq('app_key', APP_KEY);

      await admin.from('mfa_verification_attempts').insert({
        user_id: userId, context: 'recovery_login', success: true, app_key: APP_KEY,
      });

      return json({
        ok: true,
        message: 'Recovery code accepted. Two-factor authentication has been disabled. Please re-enable it from Security settings.',
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('mfa-guard error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
