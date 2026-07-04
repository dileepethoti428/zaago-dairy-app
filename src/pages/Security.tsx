import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck,
  ShieldOff,
  ArrowLeft,
  KeyRound,
  Loader2,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { useMfa } from '@/hooks/useMfa';
import { useRecoveryCodes } from '@/hooks/useRecoveryCodes';
import { EnableMfaDialog } from '@/components/mfa/EnableMfaDialog';
import { DisableMfaDialog } from '@/components/mfa/DisableMfaDialog';
import { PasswordConfirmDialog } from '@/components/mfa/PasswordConfirmDialog';
import { RecoveryCodesDisplay } from '@/components/mfa/RecoveryCodesDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function Security() {
  const navigate = useNavigate();
  const mfa = useMfa();
  const recovery = useRecoveryCodes();

  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const [regenPasswordOpen, setRegenPasswordOpen] = useState(false);
  const [regenOtpOpen, setRegenOtpOpen] = useState(false);
  const [regenOtp, setRegenOtp] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [newCodesOpen, setNewCodesOpen] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);

  const handleRegenerate = async () => {
    if (!mfa.verifiedFactorId || regenOtp.length !== 6) return;
    setRegenLoading(true);
    setRegenError(null);
    try {
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
        factorId: mfa.verifiedFactorId,
      });
      if (chalErr) throw chalErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfa.verifiedFactorId,
        challengeId: chal.id,
        code: regenOtp,
      });
      if (verifyErr) throw verifyErr;

      const codes = await recovery.generateAndStore(10);
      setNewCodes(codes);
      setRegenOtpOpen(false);
      setRegenOtp('');
      setNewCodesOpen(true);
      toast.success('New recovery codes generated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate';
      setRegenError(msg.toLowerCase().includes('invalid') ? 'Invalid code. Please try again.' : msg);
      setRegenOtp('');
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Security</h1>
            <p className="text-xs text-muted-foreground">Two-factor authentication and recovery codes</p>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <Card className="shadow-dairy transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {mfa.enabled ? (
                  <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
                <CardTitle>Two-Factor Authentication</CardTitle>
              </div>
              {mfa.loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : mfa.enabled ? (
                <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 hover:bg-green-500/15">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            <CardDescription>
              Add an extra layer of security using an authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mfa.enabled && mfa.lastEnabledAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                <span>Enabled {new Date(mfa.lastEnabledAt).toLocaleDateString()}</span>
              </div>
            )}

            {!mfa.loading && !mfa.enabled && (
              <Button className="w-full h-11" onClick={() => setEnableOpen(true)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Enable 2FA
              </Button>
            )}

            {!mfa.loading && mfa.enabled && (
              <Button
                variant="outline"
                className="w-full h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDisableOpen(true)}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                Disable 2FA
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recovery Codes */}
        {mfa.enabled && (
          <Card className="shadow-dairy">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Recovery Codes
              </CardTitle>
              <CardDescription>
                One-time codes that let you sign in if you lose access to your authenticator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
                <span className="text-sm text-muted-foreground">Codes remaining</span>
                <span className="font-mono text-sm font-semibold">
                  {recovery.loading ? '…' : (recovery.remainingCount ?? 0)}
                </span>
              </div>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => setRegenPasswordOpen(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate codes
              </Button>
              <p className="text-xs text-muted-foreground">
                Regenerating will invalidate any previous recovery codes.
              </p>
            </CardContent>
          </Card>
        )}

        <Separator />
        <p className="text-center text-xs text-muted-foreground">
          Compatible with Google Authenticator, Microsoft Authenticator, Authy, and 2FAS.
        </p>
      </div>

      {/* Enable */}
      <EnableMfaDialog
        open={enableOpen}
        onOpenChange={setEnableOpen}
        onEnabled={() => {
          mfa.refresh();
          recovery.refresh();
        }}
      />

      {/* Disable */}
      {mfa.verifiedFactorId && (
        <DisableMfaDialog
          open={disableOpen}
          onOpenChange={setDisableOpen}
          verifiedFactorId={mfa.verifiedFactorId}
          onDisabled={() => {
            mfa.refresh();
            recovery.refresh();
          }}
        />
      )}

      {/* Regenerate: password → OTP → new codes */}
      <PasswordConfirmDialog
        open={regenPasswordOpen}
        onOpenChange={setRegenPasswordOpen}
        title="Confirm password to regenerate"
        description="For security, please re-enter your password."
        onConfirmed={() => setRegenOtpOpen(true)}
      />

      <Dialog open={regenOtpOpen} onOpenChange={setRegenOtpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Enter authenticator code</DialogTitle>
            <DialogDescription className="text-center">
              Enter the current 6-digit code to generate new recovery codes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <InputOTP maxLength={6} value={regenOtp} onChange={setRegenOtp} disabled={regenLoading}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {regenError && <p className="text-sm text-destructive">{regenError}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRegenOtpOpen(false)} disabled={regenLoading}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleRegenerate}
              disabled={regenOtp.length !== 6 || regenLoading}
            >
              {regenLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : 'Regenerate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newCodesOpen} onOpenChange={setNewCodesOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Your new recovery codes</DialogTitle>
            <DialogDescription className="text-center">
              Previous codes are no longer valid. Save these now.
            </DialogDescription>
          </DialogHeader>
          <RecoveryCodesDisplay codes={newCodes} onDone={() => setNewCodesOpen(false)} doneLabel="Done" />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
