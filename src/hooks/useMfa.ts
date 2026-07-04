import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MfaStatus = {
  loading: boolean;
  enabled: boolean;
  verifiedFactorId: string | null;
  unverifiedFactorIds: string[];
  lastEnabledAt: string | null;
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
  refresh: () => Promise<void>;
};

/** Reads the current user's TOTP factor state + AAL levels. */
export function useMfa(): MfaStatus {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [unverifiedFactorIds, setUnverifiedFactorIds] = useState<string[]>([]);
  const [lastEnabledAt, setLastEnabledAt] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<'aal1' | 'aal2' | null>(null);
  const [nextLevel, setNextLevel] = useState<'aal1' | 'aal2' | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totp = factorsData?.totp ?? [];
      const verified = totp.find((f) => f.status === 'verified') ?? null;
      const unverified = totp.filter((f) => f.status !== 'verified').map((f) => f.id);

      setVerifiedFactorId(verified?.id ?? null);
      setUnverifiedFactorIds(unverified);
      setEnabled(Boolean(verified));
      setLastEnabledAt(verified?.updated_at ?? verified?.created_at ?? null);

      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setCurrentLevel((aalData?.currentLevel as 'aal1' | 'aal2' | null) ?? null);
      setNextLevel((aalData?.nextLevel as 'aal1' | 'aal2' | null) ?? null);
    } catch (err) {
      console.error('useMfa refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return {
    loading,
    enabled,
    verifiedFactorId,
    unverifiedFactorIds,
    lastEnabledAt,
    currentLevel,
    nextLevel,
    refresh,
  };
}

/** Re-verify the current user's password without disturbing the session. */
export async function reauthenticateWithPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email) return { ok: false, error: 'No email on session' };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
