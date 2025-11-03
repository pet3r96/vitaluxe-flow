# How to Apply Migration

## Quick Steps to Apply Migration

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/qbtsfajshnrwwlfzkeog
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Copy & Paste Migration
1. Open the file: `supabase/migrations/20251103060000_consolidate_rls_and_fix_conflicts.sql`
2. Select all (Cmd+A / Ctrl+A)
3. Copy (Cmd+C / Ctrl+C)
4. Paste into the SQL Editor

### Step 3: Run Migration
1. Click the **Run** button (or press Cmd+Enter / Ctrl+Enter)
2. Wait for execution to complete
3. Check for any errors in the output panel

### Step 4: Verify Success
Look for output like:
```
Success. No rows returned
```

If you see errors, check the error message and verify:
- All tables exist (patient_accounts, patient_follow_ups, etc.)
- The has_role function exists

---

## Alternative: Direct SQL Execution

If you prefer, you can also run this SQL directly in the SQL Editor:

```sql
-- Full migration SQL is in: supabase/migrations/20251103060000_consolidate_rls_and_fix_conflicts.sql
-- Copy the entire file contents and paste here
```

---

## What This Migration Does

✅ Consolidates 4 conflicting function versions into 1  
✅ Removes 24 duplicate policies  
✅ Creates 24 definitive policies with active status checks  
✅ Uses transaction safety (BEGIN/COMMIT)  
✅ Safe to run (uses IF EXISTS throughout)

---

## Rollback (if needed)

If something goes wrong, you can:
1. Check the error message in the SQL Editor output
2. Review current policies: `SELECT * FROM pg_policies WHERE tablename IN ('patient_accounts', 'patient_follow_ups');`
3. Contact Supabase support if needed

The migration uses `BEGIN`/`COMMIT`, so if it fails, nothing changes.

