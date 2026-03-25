
## Root Cause

The code in `Auth.tsx` (line 146) uses:
```typescript
redirectTo: `${window.location.origin}/reset-password`
```

When the app is running at the Lovable preview URL (`https://id-preview--...lovable.app`), `window.location.origin` resolves to that preview URL — **not** `https://zaago-dairy-app.vercel.app`. Supabase sends the reset email with whichever `redirectTo` was passed at the time the email was requested.

Additionally, Supabase has an **"Allowed Redirect URLs"** allowlist. If the URL passed in `redirectTo` is not on that list, Supabase silently falls back to the **Site URL** configured in your project — which is currently set to `https://www.zaago.online/`, explaining why you end up there.

---

## What Needs to Be Done

### 1. Fix the code — hardcode the production redirect URL

Change line 146 in `src/pages/Auth.tsx` from:
```typescript
redirectTo: `${window.location.origin}/reset-password`,
```
to:
```typescript
redirectTo: `https://zaago-dairy-app.vercel.app/reset-password`,
```

This ensures the reset email always points to your Vercel app regardless of where the code runs.

### 2. Supabase Dashboard — 3 settings to update (you do this, not code)

You need to update these in **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Value to set |
|---|---|
| **Site URL** | `https://zaago-dairy-app.vercel.app` |
| **Redirect URLs** (add both) | `https://zaago-dairy-app.vercel.app/**` |
| | `https://zaago-dairy-app.vercel.app/reset-password` |

Direct link: `https://supabase.com/dashboard/project/amhpjsmubciahslghobw/auth/url-configuration`

Without these, Supabase will reject or ignore the `redirectTo` and fall back to the Site URL (`zaago.online`).

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/Auth.tsx` | Hardcode `redirectTo` to `https://zaago-dairy-app.vercel.app/reset-password` |
