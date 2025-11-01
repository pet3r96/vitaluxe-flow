# Local Testing Guide for Patient Tables Merge

## Current Situation

Your Supabase project (`qbtsfajshnrwwlfzkeog`) currently doesn't have the `patients` or `patient_accounts` tables set up. Before testing the merge migration, you need to:

1. **Apply base migrations** - These create the `patients` and `patient_accounts` tables
2. **Then apply the merge migration** - This merges them together

## Option 1: Apply All Migrations via Supabase CLI

### Step 1: Check your connection
```bash
cd /Users/paigesporn/.cursor/worktrees/vitaluxe-flow/YFqu4
supabase link --project-ref qbtsfajshnrwwlfzkeog
```

### Step 2: Push all migrations
```bash
supabase db push
```

This will apply all migrations in order, including:
- Base migrations that create `patients` and `patient_accounts` tables
- The merge migration (`20251031153732_merge_patient_accounts_and_patients.sql`)
- The cleanup migration (`20251031153900_cleanup_after_merge_patients.sql`)

## Option 2: Apply Migrations Manually via SQL

If you prefer to apply migrations manually:

### Step 1: Apply base migrations first
You need to apply migrations that create the base tables:
- `20251009084629_*` - Creates profiles, products, etc.
- `20251009200238_*` - Creates patients table
- `20251028032705_*` - Creates patient_accounts table

### Step 2: Then apply merge migration
Apply: `supabase/migrations/20251031153732_merge_patient_accounts_and_patients.sql`

### Step 3: Apply cleanup migration
Apply: `supabase/migrations/20251031153900_cleanup_after_merge_patients.sql`

## Option 3: Test with Local Supabase Instance

If you want to test completely locally:

### Step 1: Start local Supabase
```bash
supabase start
```

### Step 2: Apply migrations
```bash
supabase migration up
```

## Verification Steps

After applying migrations, verify:

1. **Check patient_accounts table exists:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'patient_accounts';
```

2. **Check patients table is dropped (after cleanup):**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'patients';
-- Should return empty after cleanup migration
```

3. **Check data migration:**
```sql
SELECT COUNT(*) FROM patient_accounts;
-- Should match sum of patients + patient_accounts before merge
```

4. **Check foreign keys:**
```sql
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'patient_accounts';
```

## Important Notes

⚠️ **Backup First!** Always backup your database before applying migrations.

⚠️ **Test Environment:** Consider testing on a development/staging database first.

⚠️ **Migration Order:** The migrations must be applied in chronological order (by timestamp).

## Quick Test Command

Run this to check your current state:
```bash
supabase db execute "
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN '✅ patients table exists' ELSE '❌ patients table missing' END as patients_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_accounts') THEN '✅ patient_accounts table exists' ELSE '❌ patient_accounts table missing' END as patient_accounts_status;
"
```

