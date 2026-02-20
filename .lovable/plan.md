

# Fix: Email Still Not Confirmed After Verification

## What Happened

The user verified their email, the function logged "Email verified successfully", but their auth record still shows `email_confirmed_at = NULL`. The `updateUserById` call either ran the old code (before the fix was deployed) or silently failed because we don't check its return value.

## Fix (2 Parts)

### 1. Fix the affected user immediately

Run a database migration that confirms the email for any user whose profile is `status = 'active'` and `verified_at IS NOT NULL` but whose auth `email_confirmed_at` is still NULL. This catches this user and any others in the same state.

```sql
-- Confirm auth email for users who completed custom verification
-- but whose auth record was never updated
UPDATE auth.users
SET email_confirmed_at = p.verified_at
FROM public.profiles p
WHERE auth.users.id = p.id
  AND p.status = 'active'
  AND p.verified_at IS NOT NULL
  AND auth.users.email_confirmed_at IS NULL;
```

### 2. Make verify-email edge function check the auth confirm result

Move the `updateUserById` call to AFTER the profile error check, and actually check its result. If it fails, return an error so verification doesn't silently half-complete.

**File: `supabase/functions/verify-email/index.ts`**

- Move `updateUserById` after the `profileError` check
- Capture and check its error result
- If it fails, log the error and return a failure response

| Step | Change |
|------|--------|
| Database migration | Backfill `email_confirmed_at` for already-verified users |
| `supabase/functions/verify-email/index.ts` | Check `updateUserById` result, fail if it errors |

