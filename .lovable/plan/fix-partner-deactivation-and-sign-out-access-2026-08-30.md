# Fix partner deactivation and sign-out access

## Confirmed findings
- Vinay's application currently exists as `approved` with role `user`, but the database value is `is_active = true`. The app therefore has no deactivated state to enforce for this account.
- The current deactivate mutation only checks for a request error; it does not verify that a row was actually updated to `is_active = false`, so a no-op can still show “Account deactivated.”
- The current sign-out flow ignores errors from Supabase and immediately navigates. The `/auth` page also redirects during render whenever stale user state remains, which can send the user straight back into the app.

## Implementation
1. **Make deactivate/activate verifiable**
   - Update the partner management mutations to request the changed row and confirm its final `is_active` value before showing success.
   - Show an error instead of a success toast if no application changed or the returned value is wrong.
   - Refresh the relevant partner list after a verified update.

2. **Make account blocking fail closed**
   - Reset stale application state whenever the authenticated user changes, then keep protected routes loading until the fresh application lookup finishes.
   - Treat a partner application with `is_active = false` as blocked before allowing any protected page, and continue showing the deactivated screen with the existing customer-care contacts.
   - Keep realtime, focus, and periodic checks so an already-open session is removed from app content promptly after deactivation.

3. **Make sign-out reliable**
   - Return and handle the Supabase sign-out result instead of ignoring it.
   - Clear local auth/access state only through a consistent sign-out path, then redirect after sign-out succeeds; surface an error if it fails.
   - Replace render-time navigation on the auth page with a guarded redirect so stale state cannot immediately reopen the app.

4. **Verify both reported cases**
   - Typecheck the changed files.
   - Confirm in the database that deactivating Vinay changes `is_active` to `false`, then verify his active session displays the deactivated screen rather than app content.
   - Verify confirmed sign-out lands on `/auth` and protected URLs redirect back to `/auth` without reopening the app.

## Technical scope
- Frontend auth context, route guard, auth page, sign-out handlers, and partner activation hooks.
- No changes to Vinay's account will be made during implementation unless performed through the app's existing admin control while testing.
