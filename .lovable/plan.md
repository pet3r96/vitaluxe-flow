
# Fix: Pharmacy Staff Creation Creates Phantom Pharmacy Record

## Root Cause

When a pharmacy owner adds a staff member via the "Add Staff Member" dialog:

1. The `AddPharmacyStaffDialog` sends `role: 'pharmacy_staff'` to the `assign-user-role` edge function
2. The edge function normalizes this to `role: 'pharmacy'` (line 418) so RLS policies work
3. The `create_user_with_role` RPC sees `role = 'pharmacy'` and creates a **new record in the `pharmacies` table** -- this is the bug
4. The edge function then also correctly creates a `pharmacy_staff` record

Result: the new staff member appears as a standalone pharmacy in the Pharmacy Management table AND as staff -- exactly the Bob Fasano issue.

## Fix

**File: `supabase/functions/assign-user-role/index.ts`**

Track the original role before normalization, then pass a flag in the roleData so the RPC can skip creating a `pharmacies` record.

- Before line 418 (where `signupData.role` is set to `'pharmacy'`), store a flag: `signupData.roleData.isPharmacyStaff = true`
- After the RPC call completes but before pharmacy-specific logic runs (line 818-831 where priority_map is updated), add a guard to skip that section for pharmacy staff

**Database: Update `create_user_with_role` RPC**

Modify the `IF p_role = 'pharmacy'` block to check for the `isPharmacyStaff` flag in `p_role_data` and skip the `pharmacies` INSERT when it's true:

```sql
IF p_role = 'pharmacy' AND NOT COALESCE((p_role_data->>'isPharmacyStaff')::boolean, false) THEN
  -- existing pharmacies INSERT logic
END IF;
```

This ensures:
- Actual pharmacy accounts still get a `pharmacies` record created
- Pharmacy staff accounts only get a `pharmacy_staff` record (handled later in the edge function)
- The `user_roles` entry is still set to `pharmacy` for RLS compatibility

## Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/assign-user-role/index.ts` | Add `isPharmacyStaff = true` flag to roleData before role normalization; guard priority_map update |
| `create_user_with_role` RPC (migration) | Add `isPharmacyStaff` check to skip `pharmacies` INSERT for staff users |

## Verification

After the fix:
- Adding a pharmacy staff member will only create entries in `profiles`, `user_roles` (as `pharmacy`), and `pharmacy_staff`
- No phantom record will appear in the `pharmacies` table
- The Pharmacy Management table will only show actual pharmacies
- Existing pharmacy creation flow remains unchanged
