
## CRITICAL FIX: Terms Agreement Blocking All Users

### Root Causes Found (3 issues)

**Issue 1 (BLOCKER): No unique constraint on `(user_id, terms_id)` in `user_terms_acceptances`**

The upsert at line 555 uses `onConflict: 'user_id,terms_id'`, but there is NO unique index on those columns. PostgreSQL requires a unique constraint to match `onConflict`. This causes every single terms acceptance to fail with an error. This is why bob (and every other user) cannot proceed.

**Issue 2: `terms_accepted` column does not exist on `user_password_status`**

The code at line 595-602 of `generate-terms-pdf` tries to upsert `terms_accepted: true` into `user_password_status`, but that column does not exist. The table only has: `id, user_id, must_change_password, password_changed_at, created_at, updated_at`. This causes a secondary error even if Issue 1 were fixed.

Note: `admin-get-password-status` correctly derives `terms_accepted` from the `user_terms_acceptances` table (not from a column), so removing this write is safe.

**Issue 3: `get-user-context` queries non-existent `terms_accepted` column**

At line 66, `get-user-context` selects `must_change_password, terms_accepted` from `user_password_status`. Since `terms_accepted` doesn't exist as a column, this silently returns `null` for it, causing all users to appear as "terms not accepted". It should derive terms status from `user_terms_acceptances` like `admin-get-password-status` does.

### Fixes

**Fix 1: Database migration -- Add unique constraint**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_terms_unique 
ON user_terms_acceptances (user_id, terms_id);
```

**Fix 2: `supabase/functions/generate-terms-pdf/index.ts` (lines 592-607)**

Remove the `user_password_status` upsert block that writes `terms_accepted`. It's not needed -- terms acceptance is tracked by the existence of rows in `user_terms_acceptances`.

**Fix 3: `supabase/functions/get-user-context/index.ts` (lines 63-68 and 125-133)**

- Change the `user_password_status` select to only query `must_change_password` (remove `terms_accepted`)
- Add a parallel query to `user_terms_acceptances` to check if user has accepted terms (same pattern as `admin-get-password-status`)
- Derive `termsAccepted` from the existence of a record in `user_terms_acceptances`

### Deployment

Redeploy both `generate-terms-pdf` and `get-user-context` edge functions after the database migration.

### Impact

- Fixes ALL users being blocked at terms acceptance (not just bob)
- Fixes the silent "terms not accepted" bug that forces users to re-accept terms they already signed
- No data loss -- the table schema is correct, only code references and a missing index are wrong
