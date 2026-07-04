
-- Add app_key scoping so this app's MFA data is isolated from sibling apps
ALTER TABLE public.user_recovery_codes
  ADD COLUMN IF NOT EXISTS app_key text NOT NULL DEFAULT 'zaago_dairy';

ALTER TABLE public.mfa_verification_attempts
  ADD COLUMN IF NOT EXISTS app_key text NOT NULL DEFAULT 'zaago_dairy';

-- Backfill any pre-existing rows to 'legacy' so sibling apps are untouched
UPDATE public.user_recovery_codes SET app_key = 'legacy'
  WHERE app_key = 'zaago_dairy' AND created_at < now() - interval '1 minute';

UPDATE public.mfa_verification_attempts SET app_key = 'legacy'
  WHERE app_key = 'zaago_dairy' AND attempted_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user_app
  ON public.user_recovery_codes (user_id, app_key, used_at);

CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_app_time
  ON public.mfa_verification_attempts (user_id, app_key, attempted_at DESC);

-- Ensure service_role can manage (edge function uses service role for lockout tracking)
GRANT ALL ON public.mfa_verification_attempts TO service_role;
GRANT ALL ON public.user_recovery_codes TO service_role;
