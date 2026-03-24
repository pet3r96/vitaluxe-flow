

# Fix: Welcome/Verification Emails Not Sending for New Users

## Root Cause

The `assign-user-role` edge function (which handles all new user creation) calls a non-existent `email-dispatcher` function on lines 942 and 986. This means:

- **Self-signup users** never receive their verification email
- **Admin-created users** never receive their welcome email with password setup link

The working edge functions `send-welcome-email` and `send-verification-email` exist and work correctly (used by resend buttons in the UI), but `assign-user-role` was changed at some point to call `email-dispatcher` instead — which was never created.

## Fix

**File: `supabase/functions/assign-user-role/index.ts`**

### 1. Self-signup verification email (lines 938-959)

Replace the `email-dispatcher` call with a direct call to `send-verification-email`:

```typescript
const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-verification-email', {
  body: {
    userId: userId,
    email: signupData.email,
    name: signupData.name,
  }
});
```

### 2. Admin-created welcome email (lines 981-1004)

Replace the `email-dispatcher` call with a direct call to `send-welcome-email`:

```typescript
const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
  body: {
    userId: userId,
    email: signupData.email,
    name: signupData.name,
    role: signupData.role,
    practiceId: signupData.roleData?.practiceId,
  }
});
```

### 3. Deploy

Redeploy the `assign-user-role` edge function so the fix takes effect.

## Impact

- All new self-signup users will receive verification emails again
- All admin-created users will receive welcome emails with password setup links
- Existing resend buttons (in AccountDetails, StaffDetails, etc.) are unaffected — they already call the correct functions directly

