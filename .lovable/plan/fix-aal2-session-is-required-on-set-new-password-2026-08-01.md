# Fix "AAL2 session is required" on Set New Password

## What's happening

The reset-password link signs you in with a basic (AAL1) recovery session. Because your account has two-factor authentication turned on, Supabase refuses to change the password until that session is also verified with your authenticator app (AAL2). The Set New Password screen has no 2FA step, so the update fails with "AAL2 session is required to update email or password when MFA is enabled."

## The fix

Add a 2FA verification step inside the reset flow, only for accounts that have 2FA enabled:

1. When the reset page loads and the recovery session is valid, check the assurance level.
2. If 2FA is enabled and the session is still AAL1, show a "Verify your authenticator" step first:
   - 6-digit code from the authenticator app, or
   - "Use a recovery code instead" fallback (same guard function already used at login).
3. Once verified, the session becomes AAL2 and the New Password / Confirm Password form appears; the update then succeeds.
4. Accounts without 2FA see the password form immediately, exactly as today.
5. If verification fails or the user can't verify, show a clear message with an option to go back to login.

Also: keep the existing rate limiting (5 attempts / 5 minute lockout) by routing these attempts through the same guard used on the login challenge screen, so this path can't be brute-forced.

## Technical notes

- File: `src/pages/ResetPassword.tsx` — add an AAL gate using `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` and `listFactors()` after the recovery session is detected.
- Reuse the challenge/verify logic and recovery-code fallback from `src/pages/MfaChallenge.tsx`; extract the shared verification UI into a small component (e.g. `src/components/mfa/MfaVerifyStep.tsx`) so both screens use identical behavior instead of duplicating it.
- Rate limiting/attempt logging stays on the existing `mfa-guard` edge function with context `totp_login` / `recovery_login`; no database or edge-function changes required.
- After a successful password update, keep the current behavior: sign out and redirect to `/auth`.

Note: the recovery-code path in `mfa-guard` currently removes the TOTP factor entirely (disabling 2FA) — if that fallback is used here, the user will be told 2FA is off and to re-enable it from Security settings.
