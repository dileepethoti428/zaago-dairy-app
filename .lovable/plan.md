# Partner Approvals: Delete Partner + "View More" Pagination

## 1. Delete partner option

Currently the `dairy_partner_applications` table has policies for viewing, inserting and updating only — there is **no delete policy**, so a delete from the app would silently fail. A migration is required.

- **Migration**: add a policy allowing admins to delete partner applications (`has_role(auth.uid(), 'admin')`).
- **Hook** (`src/hooks/usePartnerApplications.ts`): add `useDeleteApplication` that deletes the application row by id, and also removes the partner's rows in `user_roles` and `user_center_assignments` so a deleted partner loses all access. Invalidate `partner-applications` and `partner-roles` on success.
- **UI** (`src/pages/PartnerApprovals.tsx`): add a red **Delete Partner** button (trash icon) on every card in all three tabs, opening a confirmation dialog: "Delete <name>? This permanently removes their application and access. This cannot be undone." with Cancel / Delete.

Note: this deletes the application record and access, not the underlying auth account (that requires an admin server function). If you also want the login account fully removed, say so and I'll add an edge function for it.

## 2. "View more" after 5 partners

In `ApplicationList`, keep a local `visibleCount` state starting at 5. Render only the first `visibleCount` applications; when more exist, show a **View more (N remaining)** button below the list that adds 5 more each tap (plus a **Show less** link once expanded). Applies independently to Pending, Approved and Rejected tabs.

## Technical details
- Files changed: `src/hooks/usePartnerApplications.ts`, `src/pages/PartnerApprovals.tsx`, plus one SQL migration for the delete policy.
- Uses existing shadcn `AlertDialog` and `Button` components; no new dependencies.
