# Gate new partners behind admin approval

## Problem

After registering, a new partner lands straight in the app instead of the "Application Under Review" screen.

Two confirmed causes in the current code:

1. `AuthContext` exposes `applicationStatus` but has no loading flag for it. `ProtectedRoute` only waits on the auth `loading` flag, so during the window where the status is still being fetched (`null`), it renders the app. On signup, Supabase signs the user in immediately, so the app flashes/stays open.
2. `ProtectedRoute` treats "no application row" (`applicationStatus === null`) as allowed. If the insert into `dairy_partner_applications` fails, or the row is created a moment after signup, the user gets full access permanently. The signup code logs the insert error to the console and still shows a success screen.

## Fix

**Auth context**
- Track `applicationLoading` alongside `applicationStatus`; set it true whenever a user session is detected and false once the fetch (success or error) completes.
- Expose it from the context.

**Route guard**
- Show the loading spinner while `applicationLoading` is true for a signed-in non-admin.
- Treat `applicationStatus === null` for non-admin users as "pending" and render the Application Under Review screen, instead of letting them through.
- Keep existing behaviour: admins bypass, `pending` -> under review, `rejected` -> rejection screen with reason, `approved` + active -> app.

**Signup flow**
- If the `dairy_partner_applications` insert fails, surface a destructive toast and sign the user out rather than silently showing the success screen, so no half-registered account can slip past the gate.
- After a successful submit, keep the existing confirmation screen and sign the user out (or keep them on it) so they must log back in after approval.

## Files

| File | Change |
|---|---|
| `src/contexts/AuthContext.tsx` | Add `applicationLoading` state + expose in context type/value |
| `src/components/ProtectedRoute.tsx` | Wait for application load; treat missing application as pending |
| `src/pages/Auth.tsx` | Handle application insert failure (toast + sign out) |

No database changes are needed — RLS and the pending default are already correct.
