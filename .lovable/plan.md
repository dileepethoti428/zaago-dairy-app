# Multi-Step Partner Registration

Turn the "Become a Partner" sign-up form into a guided 3-step flow with a stepper indicator like the reference image. Login and forgot-password screens stay exactly as they are.

## Stepper

A row of three numbered circles connected by lines, shown above the form:
- Current step: filled with the brand/primary color, white number
- Completed steps: filled, with a check mark
- Upcoming steps: muted circle, muted number

## Steps

**Step 1 — Your Details**
- Full Name
- Contact Number
- Email
- Password (with show/hide toggle)
- Button: Next

**Step 2 — Bank Details**
- Account Holder Name
- Account Number
- IFSC Code
- Bank Name
- Buttons: Back / Next

**Step 3 — Review & Submit**
- Read-only summary of everything entered (password masked), grouped into Your Details and Bank Details
- Buttons: Back / Submit Application

## Behaviour

- Each "Next" validates only that step's fields using the existing zod/regex rules; errors show inline and block advancing.
- "Back" preserves all entered values.
- Submission logic is unchanged: create the auth account, then insert the partner application, then show the existing "Application Submitted!" screen.
- Switching back to "Sign in" resets the flow to step 1 and clears fields.

## Technical notes

- All work stays in `src/pages/Auth.tsx`, plus a small presentational `Stepper` component in `src/components/auth/Stepper.tsx`.
- New state: `step` (1–3); split `validateForm` into `validateStep1` / `validateStep2`.
- The form's `onSubmit` only performs the real submit on step 3; earlier steps advance instead.
- Stepper colors use existing semantic tokens (`primary`, `muted`, `muted-foreground`) — no hardcoded colors.
