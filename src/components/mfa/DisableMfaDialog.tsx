import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, ShieldOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PasswordConfirmDialog } from './PasswordConfirmDialog';
import { useRecoveryCodes } from '@/hooks/useRecoveryCodes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verifiedFactorId: string;
  onDisabled: () => void;
}

type Step = 'password' | 'code';

export function DisableMfaDialog({ open, onOpenChange, verifiedFactorId, onDisabled }: Props) {
  const [step, setStep] = useState<Step>('password');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { clearAll } = useRecoveryCodes();

  useEffect(() => {
    if (!open) {
      setStep('password');
      setOtp('');
      setError(null);
      setPasswordDialogOpen(false);
    } else {
      setPasswordDialogOpen(true);
    }
  }, [open]);

  const handleDisable = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      // Verify current TOTP before unenroll
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: verifiedFactorId });
      if (chalErr) throw chalErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: verifiedFactorId,
        challengeId: chal.id,
        code: otp,
      });
      if (verifyErr) throw verifyErr;

      // Unenroll all TOTP factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      await clearAll();

      toast.success('Two-factor authentication disabled');
      onOpenChange(false);
      onDisabled();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setError(msg.toLowerCase().includes('invalid') ? 'Invalid code. Please try again.' : msg);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PasswordConfirmDialog
        open={passwordDialogOpen && step === 'password'}
        onOpenChange={(o) => {
          setPasswordDialogOpen(o);
          if (!o && step === 'password') onOpenChange(false);
        }}
        title="Confirm password to disable 2FA"
        description="For security, please re-enter your password before disabling two-factor authentication."
        onConfirmed={() => setStep('code')}
      />

      <Dialog open={open && step === 'code'} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldOff className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-center">Disable two-factor authentication</DialogTitle>
            <DialogDescription className="text-center">
              Enter the current 6-digit code from your authenticator app to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={loading}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDisable}
              disabled={otp.length !== 6 || loading}
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Disabling…</> : 'Disable 2FA'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
