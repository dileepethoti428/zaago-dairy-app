import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateRecoveryCodes, hashRecoveryCode } from '@/lib/mfaCrypto';

const APP_KEY = 'zaago_dairy';

export function useRecoveryCodes() {
  const [remainingCount, setRemainingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setRemainingCount(null);
        return;
      }
      const { count, error } = await supabase
        .from('user_recovery_codes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('app_key', APP_KEY)
        .is('used_at', null);
      if (error) throw error;
      setRemainingCount(count ?? 0);
    } catch (err) {
      console.error('useRecoveryCodes refresh error:', err);
      setRemainingCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Wipes existing codes for this app and inserts a fresh set. Returns the plaintext codes (shown once). */
  const generateAndStore = useCallback(async (count = 10): Promise<string[]> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Not authenticated');

    // Delete existing codes for this app
    await supabase
      .from('user_recovery_codes')
      .delete()
      .eq('user_id', uid)
      .eq('app_key', APP_KEY);

    const codes = generateRecoveryCodes(count);
    const rows = await Promise.all(
      codes.map(async (code) => ({
        user_id: uid,
        code_hash: await hashRecoveryCode(code),
        app_key: APP_KEY,
      }))
    );
    const { error } = await supabase.from('user_recovery_codes').insert(rows);
    if (error) throw error;

    await refresh();
    return codes;
  }, [refresh]);

  /** Called when MFA is disabled — clear this app's codes. */
  const clearAll = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase
      .from('user_recovery_codes')
      .delete()
      .eq('user_id', uid)
      .eq('app_key', APP_KEY);
    await refresh();
  }, [refresh]);

  return { remainingCount, loading, refresh, generateAndStore, clearAll };
}
