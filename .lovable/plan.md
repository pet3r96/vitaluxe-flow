
## Fix: Add `pharmacy_staff` to Allowed Roles in Validation

### Problem
The `validateCreateAccountRequest` function in `supabase/functions/_shared/requestValidators.ts` (line 127) has a hardcoded list of valid roles that does **not** include `pharmacy_staff`. When the client sends `role: 'pharmacy_staff'`, the validation rejects it with "role must be one of: admin, doctor, provider, pharmacy, practice, topline, downline, staff" before any of the downstream pharmacy staff logic can run.

### Fix

**File: `supabase/functions/_shared/requestValidators.ts`**

Add `'pharmacy_staff'` to the allowed roles array on line 127 and line 138 (same list appears in `validateAssignRoleRequest`):

```
// Line 127 - validateCreateAccountRequest
validateEnum(data.role, 'role', ['admin', 'doctor', 'provider', 'pharmacy', 'pharmacy_staff', 'practice', 'topline', 'downline', 'staff'], true),

// Line 138 - validateAssignRoleRequest  
validateEnum(data.role, 'role', ['admin', 'doctor', 'provider', 'pharmacy', 'pharmacy_staff', 'practice', 'topline', 'downline', 'staff'], true),
```

Then redeploy the `assign-user-role` edge function. One-line change in two places, same file.
