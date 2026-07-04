import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Copy, ShieldCheck, Smartphone, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PasswordConfirmDialog } from './PasswordConfirmDialog';
import { RecoveryCodesDisplay } from './RecoveryCodesDisplay';
import { useRecoveryCodes } from '@/hooks/useRecoveryCodes';

type Step = 'password' | 'scan' | 'verify' | 'recovery';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnabled: () => void;
}

export function EnableMfaDialog({ open, onOpenChange, onEnabled }: Props) {
  const [step, setStep] = useState<Step>('password');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const { generateAndStore } = useRecoveryCodes();

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('password');
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setOtp('');
      setError(null);
      setRecoveryCodes([]);
      setPasswordDialogOpen(false);
    } else {
      setPasswordDialogOpen(true);
    }
  }, [open]);

  const startEnrollment = async () => {
    setEnrolling(true);
    setError(null);
    try {
      // Clean up any previous unverified factors
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.totp ?? []) {
        if (f.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Zaago-${Date.now()}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep('scan');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start enrollment';
      setError(msg);
      toast.error(msg);
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (!factorId || otp.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr) throw chalErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chal.id,
        code: otp,
      });
      if (verifyErr) throw verifyErr;

      // Generate recovery codes
      const codes = await generateAndStore(10);
      setRecoveryCodes(codes);
      setStep('recovery');
      toast.success('Two-factor authentication enabled');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg.includes('Invalid') || msg.includes('invalid') ? 'Invalid code. Please try again.' : msg);
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      toast.success('Secret copied');
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const finish = () => {
    onOpenChange(false);
    onEnabled();
  };

  return (
    <>
      <PasswordConfirmDialog
        open={passwordDialogOpen && step === 'password'}
        onOpenChange={(o) => {
          setPasswordDialogOpen(o);
          if (!o && step === 'password') onOpenChange(false);
        }}
        title="Confirm password to enable 2FA"
        description="For security, please re-enter your password."
        onConfirmed={() => {
          setStep('scan');
          startEnrollment();
        }}
      />

      <Dialog open={open && step !== 'password'} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {step === 'scan' && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle className="text-center">Scan the QR code</DialogTitle>
                <DialogDescription className="text-center">
                  Open Google Authenticator, Authy, Microsoft Authenticator, or 2FAS and scan the code below.
                </DialogDescription>
              </DialogHeader>

              {enrolling && !qrCode && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Preparing your code…</span>
                </div>
              )}

              {qrCode && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-lg bg-white p-3">
                      <img src={qrCode} alt="MFA QR code" className="h-48 w-48" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Or enter this key manually</Label>
                    <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 p-2">
                      <code className="flex-1 break-all font-mono text-xs">{secret}</code>
                      <Button size="sm" variant="ghost" onClick={copySecret}>
                        {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => setStep('verify')}>
                    I've added the account
                  </Button>
                </div>
              )}

              {error && !enrolling && (
                <p className="text-center text-sm text-destructive">{error}</p>
              )}
            </>
          )}

          {step === 'verify' && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle className="text-center">Enter the 6-digit code</DialogTitle>
                <DialogDescription className="text-center">
                  Enter the code shown in your authenticator app.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center gap-4 py-2">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={verifying}>
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
                <Button variant="outline" className="flex-1" onClick={() => setStep('scan')} disabled={verifying}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleVerify} disabled={otp.length !== 6 || verifying}>
                  {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : 'Verify'}
                </Button>
              </div>
            </>
          )}

          {step === 'recovery' && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                  <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <DialogTitle className="text-center">2FA enabled — save your recovery codes</DialogTitle>
                <DialogDescription className="text-center">
                  Use these one-time codes if you lose access to your authenticator app.
                </DialogDescription>
              </DialogHeader>

              <RecoveryCodesDisplay codes={recoveryCodes} onDone={finish} doneLabel="Done" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
