-- Fix provider_document_patients schema after patient_accounts/patients merge
-- NOTE: After the merge, provider_document_patients.patient_id should reference patient_accounts.id directly
-- This migration ensures the foreign key constraint is correct after the merge

-- Step 1: Ensure foreign key constraint points to patient_accounts (already done in merge migration, but verify)
DO $$
BEGIN
  -- Check if constraint exists and points to correct table
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'provider_document_patients'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'provider_document_patients_patient_id_fkey'
      AND ccu.table_name = 'patient_accounts'
  ) THEN
    -- Drop old constraint if it exists and points to wrong table
    ALTER TABLE provider_document_patients 
    DROP CONSTRAINT IF EXISTS provider_document_patients_patient_id_fkey;
    
    -- Add correct constraint pointing to patient_accounts
    ALTER TABLE provider_document_patients 
    ADD CONSTRAINT provider_document_patients_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 2: Clean up any orphaned records (patient_ids that don't exist in patient_accounts)
DELETE FROM provider_document_patients pdp
WHERE NOT EXISTS (
  SELECT 1 FROM patient_accounts pa WHERE pa.id = pdp.patient_id
);