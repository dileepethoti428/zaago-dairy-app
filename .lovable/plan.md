Fix the sign-out behavior so the user is never signed out immediately after clicking “Sign Out”.

Plan:
1. Update the Settings page sign-out button to open a confirmation dialog instead of calling `signOut()` directly.
2. Reuse the same confirmation pattern already present in the header: title, message, Cancel, and confirmed Sign Out action.
3. Keep the actual sign-out only inside the confirmation action, then navigate to `/auth` after successful sign-out.
4. Verify both sign-out entry points:
   - Header profile menu → Sign Out shows confirmation first.
   - Settings page bottom Sign Out button shows confirmation first.