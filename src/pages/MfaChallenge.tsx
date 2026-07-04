import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, ShieldCheck, KeyRound, LogOut, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import zaagoLogo from '@/assets/zaago-logo.jpeg';

type Mode = 'totp' | 'recovery';

export default function MfaChallenge() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('totp');
  const [otp, setOtp] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Countdown for lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => setLockoutSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  const invokeGuard = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('mfa-guard', {
      body: { action, ...body },
    });
    if (error) throw error;
    return data as { locked?: boolean; retry_after_seconds?: number; ok?: boolean; error?: string; remaining_attempts?: number; message?: string };
  }, []);

  // Check current AAL + lockout on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        // If already AAL2 or no MFA needed, go home
        if (aal?.currentLevel === aal?.nextLevel) {
          navigate('/', { replace: true });
          return;
        }
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verified = factors?.totp?.find((f) => f.status === 'verified');
        if (!verified) {
          navigate('/', { replace: true });
          return;
        }
        setFactorId(verified.id);

        // Check server-side lockout
        try {
          const res = await invokeGuard('check_lockout');
          if (res.locked && res.retry_after_seconds) setLockoutSeconds(res.retry_after_seconds);
        } catch { /* non-fatal */ }
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate, invokeGuard]);

  const handleVerifyTotp = async () => {
    if (!factorId || otp.length !== 6 || lockoutSeconds > 0) return;
    setLoading(true);
    setError(null);
    try {
      // Server-side rate check
      const gate = await invokeGuard('check_lockout');
      if (gate.locked) {
        setLockoutSeconds(gate.retry_after_seconds ?? 300);
        setError('Too many failed attempts. Please wait.');
        return;
      }

      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr) throw chalErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chal.id,
        code: otp,
      });

      // Record attempt
      await invokeGuard('record_attempt', { success: !verifyErr, context: 'totp_login' }).catch(() => {});

      if (verifyErr) {
        // Re-check to surface immediate lockout
        const after = await invokeGuard('check_lockout').catch(() => null);
        if (after?.locked) {
          setLockoutSeconds(after.retry_after_seconds ?? 300);
          setError('Too many failed attempts. Please wait.');
        } else {
          const remaining = after?.remaining_attempts;
          setError(
            `Invalid code. ${remaining !== undefined ? `${remaining} attempts left.` : 'Please try again.'}`
          );
        }
        setOtp('');
        return;
      }

      toast.success('Verified');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async () => {
    if (!recoveryCode.trim() || lockoutSeconds > 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invokeGuard('recovery_login', { code: recoveryCode });
      if (res.locked) {
        setLockoutSeconds(res.retry_after_seconds ?? 300);
        setError('Too many failed attempts. Please wait.');
        return;
      }
      if (res.error) {
        setError(res.error);
        setRecoveryCode('');
        return;
      }
      toast.success('Recovery code accepted');
      toast.info(res.message ?? 'Two-factor authentication has been disabled. Please re-enable it from Security settings.', {
        duration: 8000,
      });
      // Session AAL should now be aal1 without MFA required
      navigate('/security', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md shadow-dairy">
        <CardHeader className="text-center">
          <img src={zaagoLogo} alt="Zaago" className="mx-auto mb-3 h-14 w-14 rounded-full object-cover" />
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl">Verify it's you</CardTitle>
          <CardDescription>
            {mode === 'totp'
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Enter one of your one-time recovery codes'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {lockoutSeconds > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Too many attempts</p>
                <p className="text-destructive/80">
                  Try again in {Math.floor(lockoutSeconds / 60)}:{(lockoutSeconds % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>
          )}

          {mode === 'totp' ? (
            <>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={loading || lockoutSeconds > 0}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && <p className="text-center text-sm text-destructive">{error}</p>}
              <Button
                className="w-full h-11"
                onClick={handleVerifyTotp}
                disabled={otp.length !== 6 || loading || lockoutSeconds > 0}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : 'Verify'}
              </Button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-base tracking-wider ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                disabled={loading || lockoutSeconds > 0}
                autoComplete="off"
                autoCapitalize="characters"
              />
              {error && <p className="text-center text-sm text-destructive">{error}</p>}
              <Button
                className="w-full h-11"
                onClick={handleRecovery}
                disabled={!recoveryCode.trim() || loading || lockoutSeconds > 0}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : 'Use recovery code'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Using a recovery code will disable 2FA. You'll be asked to set it up again.
              </p>
            </>
          )}

          <div className="flex flex-col items-center gap-2 pt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              onClick={() => {
                setMode(mode === 'totp' ? 'recovery' : 'totp');
                setError(null);
                setOtp('');
                setRecoveryCode('');
              }}
              disabled={loading}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {mode === 'totp' ? 'Use a recovery code instead' : 'Use authenticator app instead'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
