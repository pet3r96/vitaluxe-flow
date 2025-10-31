-- ============================================================================
-- CLEANUP AFTER MERGING patient_accounts AND patients TABLES
-- ============================================================================
-- This migration cleans up after the merge by:
-- 1. Updating views that reference patients table
-- 2. Dropping the patients table (after verification)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Update views that reference patients table
-- ============================================================================

-- Drop and recreate v_patients_with_portal_status view to use patient_accounts
DROP VIEW IF EXISTS public.v_patients_with_portal_status;

CREATE VIEW public.v_patients_with_portal_status AS
SELECT 
  pa.id AS patient_id,
  pa.practice_id,
  pa.user_id IS NOT NULL AS has_portal_access,
  CASE 
    WHEN pa.user_id IS NOT NULL THEN 'active'
    ELSE 'no_portal_access'
  END AS portal_status,
  pa.name,
  pa.first_name,
  pa.last_name,
  pa.email,
  pa.phone,
  pa.created_at
FROM public.patient_accounts pa;

-- Grant SELECT permissions on the view
GRANT SELECT ON public.v_patients_with_portal_status TO authenticated;
GRANT SELECT ON public.v_patients_with_portal_status TO anon;

-- ============================================================================
-- STEP 2: Update any triggers that reference patients table
-- ============================================================================

-- Note: Any triggers that reference patients.id or patients table will need
-- to be updated to reference patient_accounts instead. These should be
-- handled in a separate migration if they exist.

-- ============================================================================
-- STEP 3: Verify no foreign keys still reference patients table
-- ============================================================================

-- This should have been done in the merge migration, but double-check
DO $$
DECLARE
  constraint_record RECORD;
  constraint_count INTEGER := 0;
BEGIN
  FOR constraint_record IN
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'patients'
      AND ccu.column_name = 'id'
  LOOP
    constraint_count := constraint_count + 1;
    RAISE WARNING 'Found foreign key constraint % on table %.% still referencing patients.id',
      constraint_record.constraint_name,
      constraint_record.table_name,
      constraint_record.column_name;
  END LOOP;
  
  IF constraint_count > 0 THEN
    RAISE EXCEPTION 'Cannot drop patients table: % foreign key constraints still reference it', constraint_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Drop patients table (after all references are updated)
-- ============================================================================

-- Only drop if table exists and no foreign keys reference it
DROP TABLE IF EXISTS public.patients CASCADE;

-- ============================================================================
-- STEP 5: Update any remaining indexes or constraints
-- ============================================================================

-- Indexes on patients table will be automatically dropped with the table
-- Ensure patient_accounts has all necessary indexes

CREATE INDEX IF NOT EXISTS idx_patient_accounts_name 
ON public.patient_accounts(name);

CREATE INDEX IF NOT EXISTS idx_patient_accounts_practice_id_status 
ON public.patient_accounts(practice_id, status);

COMMIT;

