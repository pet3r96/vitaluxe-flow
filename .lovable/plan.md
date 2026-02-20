

# Fix: "duplicate key value violates unique constraint 'patient_accounts_user_id_key'" When Adding Patient

## Root Cause

The `patient_accounts` table has a **non-partial unique constraint** called `patient_accounts_user_id_key` on the `user_id` column. When adding a patient without portal access, `user_id` is not set (defaults to NULL). The constraint blocks inserting a second patient with NULL `user_id`.

A previous migration attempted to drop this constraint and replace it with a partial unique index (`patient_accounts_user_id_unique`) that only enforces uniqueness when `user_id IS NOT NULL`. However, the old constraint `patient_accounts_user_id_key` still exists in the live database -- meaning the drop either failed silently or a subsequent migration re-created it.

**Current state (3 redundant indexes on user_id):**
- `patient_accounts_user_id_key` -- full UNIQUE constraint (the problem)
- `patient_accounts_user_id_unique` -- partial UNIQUE index WHERE user_id IS NOT NULL (the correct one)
- `idx_patient_accounts_user_id` -- regular index (redundant given the above)

## Fix

### Database migration (1 file)

Drop the problematic constraint and the redundant regular index, keeping only the correct partial unique index:

```sql
-- Drop the non-partial unique constraint that blocks NULL user_id inserts
ALTER TABLE public.patient_accounts
  DROP CONSTRAINT IF EXISTS patient_accounts_user_id_key;

-- Drop redundant regular index (partial unique index already covers lookups)
DROP INDEX IF EXISTS idx_patient_accounts_user_id;
```

After this, only `patient_accounts_user_id_unique` remains, which correctly:
- Prevents two patients from sharing the same portal user account
- Allows unlimited patients with `user_id = NULL` (no portal access)

### Improve error handling in PatientDialog (1 file)

Update `src/components/patients/PatientDialog.tsx` (line 452-457) to detect unique constraint violations and show a friendlier message instead of the raw database error:

```typescript
} catch (error: any) {
  logger.warn("Error saving patient", error);
  if (error.code === '23505') {
    toast.error("A patient with this information already exists. Please check for duplicates.");
  } else {
    toast.error(error.message || "Failed to save patient");
  }
  perf.end();
}
```

## Files Changed

| File | Change |
|------|--------|
| New database migration | Drop `patient_accounts_user_id_key` constraint and redundant `idx_patient_accounts_user_id` index |
| `src/components/patients/PatientDialog.tsx` | Friendlier error message for constraint violations, downgrade to `logger.warn` |

## Impact

This unblocks adding any patient without portal access (the standard flow for practice-created patients).

