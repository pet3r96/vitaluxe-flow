

# Fix: Signup Failure - Database Function Parameter Mismatch

## Root Cause

The signup is failing because the `create_user_with_role` database function only accepts **5 parameters**, but the edge function is calling it with **10 parameters**. The database can't find a matching function signature and returns error code `22P02`.

**Database function signature (current):**
```
create_user_with_role(p_user_id, p_email, p_name, p_role, p_role_data)
```

**Edge function sends (10 params):**
```
p_user_id, p_email, p_name, p_full_name, p_prescriber_name,
p_role, p_role_data, p_status, p_created_by, p_temp_password
```

The 5 extra parameters (`p_full_name`, `p_prescriber_name`, `p_status`, `p_created_by`, `p_temp_password`) were added to the edge function code but the database function was never updated to accept them. This breaks ALL signups -- practice, pharmacy, rep, everyone.

Additionally, the error message users see is the unhelpful "Edge Function returned a non-2xx status code" because the error handling doesn't extract the actual error from the response.

## Fix Plan

### 1. Update `create_user_with_role` database function (Critical)

Add the 5 missing parameters and use them to populate the corresponding profile columns:

```sql
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_full_name text DEFAULT NULL,
  p_prescriber_name text DEFAULT NULL,
  p_role app_role,
  p_role_data jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'active',
  p_created_by uuid DEFAULT NULL,
  p_temp_password boolean DEFAULT false
)
```

The profile INSERT will include `full_name`, `prescriber_name`, `status`, `created_by`, and `temp_password`.

### 2. Fix error message extraction in `authService.signupUser`

Update `src/lib/authService.ts` to extract the actual error message from non-2xx edge function responses instead of showing the generic message. The Supabase JS client's `FunctionsHttpError` wraps the response in `error.context`:

```typescript
if (error) {
  let message = 'An unexpected error occurred during signup';
  try {
    const errorBody = await (error as any).context?.json?.();
    if (errorBody?.error) {
      message = errorBody.error;
    }
  } catch {
    message = error.message;
  }
  return { error: { message } };
}
```

## Files Changed

| File | Change | Priority |
|------|--------|----------|
| Database migration | Update `create_user_with_role` to accept all 10 parameters | Critical -- unblocks ALL signups |
| `src/lib/authService.ts` | Extract actual error messages from non-2xx responses | High -- better error UX |

## What This Fixes

- Practice signup (the user's immediate issue)
- Pharmacy signup
- Representative signup
- All admin-created user flows
- Error messages will now show the actual problem instead of a generic message

