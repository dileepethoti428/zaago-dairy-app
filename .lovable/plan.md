## Sign-Out Confirmation Dialog

Add a confirmation dialog that appears when the user taps **Sign Out** from the profile dropdown in the app header, preventing accidental logouts.

### Scope
- **File**: `src/components/layout/AppHeader.tsx`
- **Component**: Reuse existing `AlertDialog` from `src/components/ui/alert-dialog.tsx`

### Implementation
1. Import `AlertDialog` primitives in `AppHeader.tsx`.
2. Add `signOutOpen` state to control dialog visibility.
3. Replace the direct `onClick={handleSignOut}` on the Sign Out menu item with `onClick={() => setSignOutOpen(true)}`.
4. Render an `<AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>` with:
   - Title: "Sign Out"
   - Description: "Are you sure you want to sign out?"
   - Cancel button (closes dialog)
   - Confirm button (destructive variant, calls existing `handleSignOut`)
5. Ensure the dropdown menu stays open/closed correctly — the dialog overlay will handle focus.

### No changes to
- Auth logic (`AuthContext`, `signOut` method)
- Routing or navigation
- Any other pages or components