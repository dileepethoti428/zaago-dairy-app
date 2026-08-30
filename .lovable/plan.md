# Fix partner deactivation and sign-out at the source

## Confirmed root causes

- Vinay's live application row is still `is_active = true` (last updated at 07:25 UTC), so the app is currently correct to admit that account. The previous deactivation did not persist in the database.
- Deactivation is currently a direct browser update with no server-side command or audit trail. It changes only `dairy_partner_applications.is_active`; the user's valid Supabase session, role, center assignment, and database permissions remain usable.
- Current RLS policies do not check partner activation. Several dairy tables allow any authenticated user or assigned user to read/write data even if the application is deactivated. The React route guard is therefore only a visual gate, not an access-control boundary.
- The partner application's “update own bank details” RLS policy permits updates to the whole row, so a partner session can also change protected fields such as `is_active` or `status` through the API.
- The preview is using a custom auth-storage message broker, while the browser logs show its messages are not recognized. This can keep or restore stale preview auth state. Production does not need that broker and should use normal Supabase local storage.

## Implementation

1. **Create one secure admin deactivation command**
   - Add a database RPC that accepts the application ID and requested active state.
   - Verify the caller is an admin inside the database, lock/update the exact application row, and return the persisted `id`, `user_id`, and `is_active` values.
   - Make the frontend call this RPC instead of issuing a generic table update, then refetch the applications list and show success only from the returned persisted state.
   - Add an explicit confirmation dialog naming the partner before deactivation.

2. **Enforce deactivation in Supabase RLS**
   - Add a security-definer helper that considers an account allowed only when it is an admin or has an approved, active dairy partner application.
   - Add restrictive access policies to the dairy app's operational tables so a deactivated partner cannot read or modify data with a valid/stale JWT, while admins remain unaffected.
   - Preserve the partner's row and center assignment so reactivation restores access without losing configuration.

3. **Prevent self-reactivation and status tampering**
   - Replace the broad own-application update policy with a column-limited bank-details RPC.
   - Permit partners to update only account-holder, account-number, IFSC, and bank-name fields; keep `status`, `is_active`, review fields, identity, and ownership admin-controlled.
   - Update the bank-details form to use the restricted RPC.

4. **Make the client access check fail closed**
   - Track application-check failure separately from “active.” Never convert a failed fetch into an active account.
   - Keep protected routes blocked until the current user's application state is successfully confirmed.
   - On realtime changes, focus, and login, refresh the authoritative state and immediately replace protected content with the deactivated support screen when needed.

5. **Fix sign-out storage behavior**
   - Remove the incompatible preview auth broker from the Supabase client and use standard origin-local Supabase storage consistently.
   - Keep local-scope sign-out, clear in-memory/query state on success, and redirect to `/auth` only after Supabase confirms local token removal.
   - Ensure every sign-out entry point uses the same confirmed flow.

## Verification

- Query Vinay's row before and after deactivation and confirm `is_active` changes to `false`.
- Verify an authenticated deactivated-partner request is denied by RLS, not merely hidden by React.
- Verify the deactivated screen appears after login and after live admin deactivation.
- Verify reactivation returns access without recreating the center assignment.
- Verify sign-out removes the stored session, `/` redirects to `/auth`, refresh stays signed out, and the preview auth warning no longer appears.
