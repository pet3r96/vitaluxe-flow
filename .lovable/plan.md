
# Fix: "Email not confirmed" After Successful Verification

## Root Cause

The `verify-email` edge function only updates the `profiles` table (`status = 'active'`). It never confirms the email in the authentication system itself. The auth system checks `email_confirmed_at` on the auth user record -- since that remains NULL, login is blocked with "Email not confirmed" even though the custom verification flow completed successfully.

## Fix

**File: `supabase/functions/verify-email/index.ts`**

Add one line after the profile update succeeds -- use the admin API to confirm the email in the auth system:

```typescript
await supabaseAdmin.auth.admin.updateUserById(tokenData.user_id, {
  email_confirm: true,
});
```

This sets `email_confirmed_at` on the auth user record, which is what the auth system checks during login.

No other files need changes. The self-signup flow in `assign-user-role` already correctly sets `email_confirm: false` for self-signup users, expecting the verify-email function to confirm it later -- that confirmation step was just missing.
