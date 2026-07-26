## Goal
Allow admins to delete a collection center from the Collection Centers page (and its detail page), with protection against destroying linked data.

## Safety rules
The database has no foreign keys onto `collection_centers`, but several tables store a `center_id`: `milk_entries`, `farmers`, `settlements`, `user_center_assignments`, `collection_partner_bank_details`, plus `collection_center_id` on `pricing_settings` / `pricing_formula`. Deleting blindly would orphan those rows.

So deletion is blocked when the center has any linked milk entries, farmers, or settlements. In that case the UI tells the admin to deactivate instead. If only assignments/pricing rows exist, those are cleaned up as part of the delete.

## Changes

**`src/hooks/useCollectionCenters.ts`**
- Add `useCenterUsage(centerId)` — counts milk entries, farmers, and settlements for a center.
- Add `useDeleteCollectionCenter()` — re-checks counts before deleting; throws a clear message if in use. Otherwise removes `user_center_assignments`, `pricing_settings`, `pricing_formula` rows for the center, then deletes the center. Invalidates center queries and shows a toast.

**`src/pages/CenterList.tsx`**
- Add a delete (trash) action on each center row, for both active and inactive lists.
- Confirmation dialog naming the center, with a typed-safe destructive confirm and an explanation that this cannot be undone.
- If the center is in use, the dialog explains it can't be deleted and offers Deactivate instead.

**`src/pages/CenterDetail.tsx`**
- Add a "Delete Center" destructive button in the Actions card, using the same confirmation flow, navigating back to `/centers` on success.

## Technical notes
- Existing RLS: only admins can manage centers (`Admins can manage centers`, ALL) so deletes are already restricted server-side; both pages also already gate on `isAdmin`.
- No database migration required.
