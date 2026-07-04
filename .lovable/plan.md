
## Goal

Add TOTP two-factor authentication (Google Authenticator / Authy / Microsoft Authenticator / 2FAS) to the Zaago dairy web app using Supabase Auth MFA. Recovery codes, login MFA enforcement, and rate limiting are scoped **only to this app** — the two sibling apps sharing the Supabase project are not touched.

---

## User Flows

### 1. Security Settings page (`/security`)
Reachable from Settings → Security. Shows:
- Status pill: **Enabled** / **Disabled**
- Last-enabled date (when enabled)
- Recovery codes section: *View remaining count · Regenerate*
- Primary action button: **Enable 2FA** / **Disable 2FA**

### 2. Enable 2FA
1. Password re-confirm dialog (verifies via `signInWithPassword` against current email).
2. Call `supabase.auth.mfa.enroll({ factorType: 'totp' })` → get `factor.id`, `totp.qr_code` (SVG data URI), `totp.secret`.
3. Show QR + manual secret + step-by-step instructions.
4. 6-digit OTP input → `mfa.challenge` + `mfa.verify`.
5. On success:
   - Generate 10 recovery codes client-side (crypto random, 10 chars each), hash with SHA-256, store hashes in `user_recovery_codes` (scoped by `app_key = 'zaago_dairy'` so the other apps' rows stay separate).
   - Show codes once with **Copy all** / **Download .txt** + a "I've saved them" confirm dialog before dismissing.

### 3. Login MFA challenge
After password login succeeds, check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. If `nextLevel === 'aal2'` and current is `'aal1'`:
- Route to `/auth/mfa` (blocks all `ProtectedRoute` children until AAL2).
- Accept 6-digit code → `mfa.challenge` + `mfa.verify`.
- "Use recovery code instead" link → verify hash against `user_recovery_codes`, mark row used, then elevate session via edge function that issues an AAL2 session (see technical section).
- Sign out button as escape hatch.

### 4. Disable 2FA
1. Password re-confirm.
2. Current TOTP code (or recovery code).
3. `mfa.unenroll(factorId)` for all TOTP factors owned by this user.
4. Delete this user's rows from `user_recovery_codes` where `app_key = 'zaago_dairy'`.
5. Success toast + return to Security page (now Disabled).

### 5. Regenerate recovery codes
Requires password + current TOTP. Deletes old zaago_dairy codes, inserts 10 new hashes, displays plaintext once. Warning banner: *"Your previous recovery codes are now invalid."*

---

## Rate Limiting (server-side)

New edge function `mfa-rate-limit` + new table `mfa_verification_attempts`:
- Track `(user_id, app_key, attempt_at, success)`.
- Before each verify, function checks: **5 failures in the last 5 minutes → locked**.
- Response returns `{ locked: true, retry_after_seconds }` so UI can show live countdown.
- On success, clear that user's failure window.
- Uses `app_key = 'zaago_dairy'` so sibling apps aren't affected.

---

## Files

### New
| File | Purpose |
|---|---|
| `src/pages/Security.tsx` | Security settings landing |
| `src/pages/MfaChallenge.tsx` | Post-login AAL2 gate (`/auth/mfa`) |
| `src/components/mfa/EnableMfaDialog.tsx` | Multi-step enroll wizard (password → QR → verify → recovery codes) |
| `src/components/mfa/DisableMfaDialog.tsx` | Password + TOTP disable flow |
| `src/components/mfa/RecoveryCodesDisplay.tsx` | Copy / download / confirm-saved UI |
| `src/components/mfa/PasswordConfirmDialog.tsx` | Reusable password re-auth |
| `src/components/mfa/OtpInput.tsx` | Wraps existing `input-otp` with error/loading states |
| `src/hooks/useMfa.ts` | Wraps enroll/challenge/verify/unenroll/list + status |
| `src/hooks/useRecoveryCodes.ts` | Generate, hash, persist, verify, regenerate |
| `src/lib/mfaCrypto.ts` | Recovery code generation + SHA-256 hashing (Web Crypto) |
| `supabase/functions/mfa-rate-limit/index.ts` | Server-side attempt tracking & lockout |

### Modified
| File | Change |
|---|---|
| `src/App.tsx` | Add `/security` and `/auth/mfa` routes |
| `src/components/ProtectedRoute.tsx` | If AAL requires aal2 and current is aal1, redirect to `/auth/mfa` |
| `src/contexts/AuthContext.tsx` | Expose `aal`, `nextAal`, `mfaEnabled`, refresh on auth state change |
| `src/pages/Settings.tsx` | Add "Security" link/card |
| `src/pages/Auth.tsx` | After sign-in, check AAL and route to `/auth/mfa` if needed |

---

## Database Migration

Two additions, both scoped by `app_key` so the other two apps are unaffected:

```text
1. Add column to existing user_recovery_codes:
     app_key text not null default 'zaago_dairy'
     code_hash text  (if not already present — schema shows 5 cols; verify)
     used_at timestamptz
   Add index (user_id, app_key, used_at)
   GRANT + RLS: users manage only their own rows scoped to app_key='zaago_dairy'

2. Reuse existing mfa_verification_attempts table if columns match; otherwise
   add missing columns (app_key, ip nullable, success boolean).
   RLS: insert/select only own rows; edge function uses service role.
```

Existing rows in `user_recovery_codes` / `mfa_verification_attempts` from the other two apps get `app_key` defaulted to their prior value (we'll set the default only for new inserts and backfill any nulls to `'legacy'` so the other apps' logic is untouched).

The migration will be presented for approval before any code is written against the new columns.

---

## Technical Notes

- **AAL detection:** `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` returns `{ currentLevel, nextLevel }`. Enforce `currentLevel === nextLevel` before allowing app access when TOTP is enrolled.
- **Recovery-code login:** Supabase MFA has no native recovery-code path. Edge function `mfa-recovery-login` verifies the code hash, marks it used, and calls `supabase.auth.admin.generateLink` or issues a step-up via a signed short-lived token → client exchanges for AAL2. (Falls back to prompting the user to contact support if this proves brittle; will be validated during build.)
- **Rate limiting:** all verify calls (TOTP + recovery) go through the edge function first for the lockout check, then perform the actual Supabase verify.
- **Isolation:** every write to shared tables includes `app_key = 'zaago_dairy'`; every read filters on it. No changes to code paths used by the other two apps.
- **Design:** existing shadcn Dialog, Card, Button, InputOTP components with Zaago tokens. Loading states use existing `LoadingOverlay` / `InlineLoading`. Success uses subtle scale/opacity transitions already in tailwind config.

---

## Out of Scope

- SMS / email OTP factors
- Enforcing MFA on the other two sibling apps
- Admin-level MFA management (forcing reset for other users)
