import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { MfaVerifyStep } from '@/components/mfa/MfaVerifyStep';
import zaagoLogo from '@/assets/zaago-logo.jpeg';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  // MFA gate: Supabase requires an AAL2 session to change the password when 2FA is on
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  /** Determines whether this session still needs a TOTP step before updating the password. */
  const checkMfaGate = useCallback(async () => {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel !== 'aal2' || aal?.currentLevel === 'aal2') {
        setMfaRequired(false);
        setMfaFactorId(null);
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === 'verified');
      if (!verified) {
        setMfaRequired(false);
        setMfaFactorId(null);
        return;
      }
      setMfaFactorId(verified.id);
      setMfaRequired(true);
    } catch (err) {
      console.error('MFA gate check failed:', err);
      setMfaRequired(false);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      // Check legacy hash-based flow first
      const hash = window.location.hash;
      if (hash.includes('type=recovery')) {
        setIsRecoverySession(true);
        await checkMfaGate();
        setChecking(false);
        return;
      }

      // For PKCE flow: Supabase auto-exchanges the ?code= param for a session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsRecoverySession(true);
        await checkMfaGate();
      }
      setChecking(false);
    };

    // Also listen for the event in case it fires after mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
        checkMfaGate().finally(() => setChecking(false));
      }
    });

    checkSession();

    return () => subscription.unsubscribe();
  }, [checkMfaGate]);


  const validate = () => {
    const newErrors: typeof errors = {};
    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({
          title: 'Failed to update password',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setSuccess(true);
        await supabase.auth.signOut();
        setTimeout(() => navigate('/auth'), 2500);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Loading state while we detect recovery session
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-full max-w-md shadow-dairy text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">Password Updated!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your password has been changed successfully. Redirecting you to login…
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Invalid / expired token
  if (!isRecoverySession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-full max-w-md shadow-dairy text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Link Expired or Invalid</CardTitle>
            <CardDescription className="text-base mt-2">
              This password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full h-12" onClick={() => navigate('/auth')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2FA gate: password change needs an AAL2 session when MFA is enabled
  if (mfaRequired && mfaFactorId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-full max-w-md shadow-dairy">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Verify it's you</CardTitle>
            <CardDescription>
              Your account has two-factor authentication enabled. Enter your authenticator code to
              continue setting a new password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MfaVerifyStep
              factorId={mfaFactorId}
              context="totp_login"
              onVerified={async () => {
                await checkMfaGate();
                toast({ title: 'Verified', description: 'You can now set a new password.' });
              }}
              onRecoveryUsed={async (message) => {
                await checkMfaGate();
                toast({ title: 'Recovery code accepted', description: message });
              }}
            />
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/auth', { replace: true });
              }}
            >
              Cancel and go back to login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md shadow-dairy">
        <CardHeader className="text-center">
          <img src={zaagoLogo} alt="Zaago" className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
          <CardTitle className="text-2xl font-semibold">Set New Password</CardTitle>
          <CardDescription>Enter a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="h-12 w-full text-base font-medium" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating password…
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
