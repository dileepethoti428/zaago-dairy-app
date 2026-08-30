# Deactivated partners must be locked out immediately

## Problem

The lockout screen for deactivated accounts already exists, but the app only reads `is_active` from `dairy_partner_applications` at login / page load. When an admin deactivates a partner who is already signed in, nothing re-checks the flag, so that session keeps full access until the user reloads or logs out.

The lockout screen also only lists a phone number, while Help & Support in Settings shows WhatsApp, email and call options.

## Fix

**Keep the account status live**
- In `AuthContext`, subscribe to Supabase Realtime changes on the signed-in user's row in `dairy_partner_applications` (filtered by `user_id`) and update `applicationStatus`, `applicationRejectionReason` and `accountDeactivated` when the row changes. Clean the channel up on sign-out/unmount.
- As a safety net (in case Realtime is not enabled for that table), also re-fetch the application status when the tab regains focus and on a periodic interval (a few minutes).
- If Realtime is not yet enabled for `dairy_partner_applications`, add it with a migration (`ALTER PUBLICATION supabase_realtime ADD TABLE ...` plus `REPLICA IDENTITY FULL`). No policy changes needed — the existing "Users can view own application" policy already covers the subscription.

**Better deactivated screen**
- Update `ApplicationPending` (deactivated state) to show the same three contact options as Help & Support:
  - WhatsApp +91-7842343642
  - Email zaago.online@gmail.com
  - Call +91-7842343642
- Keep the existing "Account Deactivated — contact customer care" message, icon and Sign Out button, styled with existing tokens.

## Files

| File | Change |
|---|---|
| `src/contexts/AuthContext.tsx` | Realtime subscription + focus/interval revalidation of application status |
| `src/pages/ApplicationPending.tsx` | Add WhatsApp / Email / Call contact rows to the deactivated state |
| migration | Enable Realtime for `dairy_partner_applications` if not already enabled |

Route guarding logic in `ProtectedRoute` stays as-is; it already renders the deactivated screen once the flag flips.
