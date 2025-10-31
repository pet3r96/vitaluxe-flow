-- Fix provider_document_patients schema and backfill data (correct order)

-- Step 1: Drop incorrect foreign key constraint to patient_accounts
ALTER TABLE provider_document_patients 
DROP CONSTRAINT IF EXISTS provider_document_patients_patient_id_fkey;

-- Step 2: Backfill existing data BEFORE adding new constraint
DO $$
DECLARE
  updated_count INTEGER := 0;
  unresolvable_count INTEGER := 0;
  row_record RECORD;
BEGIN
  -- Find rows where patient_id does not exist in patients.id (but might exist in patient_accounts.id)
  FOR row_record IN 
    SELECT pdp.id, pdp.patient_id
    FROM provider_document_patients pdp
    LEFT JOIN patients p ON pdp.patient_id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Try to resolve via patient_accounts.id -> patients.patient_account_id
    UPDATE provider_document_patients
    SET patient_id = (
      SELECT p.id 
      FROM patients p 
      WHERE p.patient_account_id = row_record.patient_id
      LIMIT 1
    )
    WHERE id = row_record.id
    AND EXISTS (
      SELECT 1 
      FROM patients p 
      WHERE p.patient_account_id = row_record.patient_id
    );
    
    IF FOUND THEN
      updated_count := updated_count + 1;
    ELSE
      unresolvable_count := unresolvable_count + 1;
      RAISE NOTICE 'Could not resolve patient_id % for row %', row_record.patient_id, row_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: % rows updated, % unresolvable', updated_count, unresolvable_count;
END $$;

-- Step 3: Add correct foreign key constraint to patients table (after data is fixed)
ALTER TABLE provider_document_patients 
ADD CONSTRAINT provider_document_patients_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;