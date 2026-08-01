import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Mode = 'totp' | 'recovery';

type GuardResponse = {
  locked?: boolean;
  retry_after_seconds?: number;
  ok?: boolean;
  error?: string;
  remaining_attempts?: number;
  message?: string;
};

interface MfaVerifyStepProps {
  factorId: string;
  /** Called after a successful TOTP verification (session is now AAL2). */
  onVerified: () => void;
  /** Called after a recovery code is accepted — 2FA is now disabled. */
  onRecoveryUsed?: (message: string) => void;
  /** Rate-limit context label recorded server-side. */
  context?: string;
  allowRecovery?: boolean;
}

/** Shared "verify it's you" step: authenticator code with recovery-code fallback. */
export function MfaVerifyStep({
  factorId,
  onVerified,
  onRecoveryUsed,
  context = 'totp_login',
  allowRecovery = true,
}: MfaVerifyStepProps) {
  const [mode, setMode] = useState<Mode>('totp');
  const [otp, setOtp] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => setLockoutSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  const invokeGuard = useCallback(
    async (action: string, body: Record<string, unknown> = {}): Promise<GuardResponse> => {
      const { data, error: fnErr } = await supabase.functions.invoke('mfa-guard', {
        body: { action, ...body },
      });
      if (fnErr) throw fnErr;
      return (data ?? {}) as GuardResponse;
    },
    []
  );

  useEffect(() => {
    invokeGuard('check_lockout')
      .then((res) => {
        if (res.locked && res.retry_after_seconds) setLockoutSeconds(res.retry_after_seconds);
      })
      .catch(() => {});
  }, [invokeGuard]);

  const handleVerifyTotp = async () => {
    if (otp.length !== 6 || lockoutSeconds > 0) return;
    setLoading(true);
    setError(null);
    try {
      const gate = await invokeGuard('check_lockout').catch(() => ({}) as GuardResponse);
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

      await invokeGuard('record_attempt', { success: !verifyErr, context }).catch(() => {});

      if (verifyErr) {
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

      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
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
      onRecoveryUsed?.(
        res.message ??
          'Two-factor authentication has been disabled. Please re-enable it from Security settings.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {lockoutSeconds > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-destructive">Too many attempts</p>
            <p className="text-destructive/80">
              Try again in {Math.floor(lockoutSeconds / 60)}:
              {(lockoutSeconds % 60).toString().padStart(2, '0')}
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
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Verify'
            )}
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
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Use recovery code'
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Using a recovery code will disable 2FA. You'll be asked to set it up again.
          </p>
        </>
      )}

      {allowRecovery && (
        <div className="flex justify-center pt-1">
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
        </div>
      )}
    </div>
  );
}
