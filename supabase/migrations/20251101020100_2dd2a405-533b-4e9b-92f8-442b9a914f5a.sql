-- ============================================================================
-- FIX ORPHANED PATIENT REFERENCES - Complete Cleanup
-- ============================================================================

-- Step 1: Drop all FK constraints first (they're blocking the data updates)
ALTER TABLE cart_lines DROP CONSTRAINT IF EXISTS cart_lines_patient_id_fkey CASCADE;
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_patient_id_fkey CASCADE;
ALTER TABLE internal_messages DROP CONSTRAINT IF EXISTS internal_messages_patient_id_fkey CASCADE;
ALTER TABLE provider_document_patients DROP CONSTRAINT IF EXISTS provider_document_patients_patient_id_fkey CASCADE;
ALTER TABLE provider_documents DROP CONSTRAINT IF EXISTS provider_documents_assigned_patient_id_fkey CASCADE;

-- Step 2: Now update the orphaned references (no FK blocking us)
UPDATE order_lines ol
SET patient_id = p.patient_account_id
FROM patients p
WHERE ol.patient_id = p.id
  AND p.patient_account_id IS NOT NULL
  AND p.id != p.patient_account_id;

UPDATE cart_lines cl
SET patient_id = p.patient_account_id
FROM patients p
WHERE cl.patient_id = p.id
  AND p.patient_account_id IS NOT NULL
  AND p.id != p.patient_account_id;

UPDATE internal_messages im
SET patient_id = p.patient_account_id
FROM patients p
WHERE im.patient_id = p.id
  AND p.patient_account_id IS NOT NULL
  AND p.id != p.patient_account_id;

UPDATE provider_document_patients pdp
SET patient_id = p.patient_account_id
FROM patients p
WHERE pdp.patient_id = p.id
  AND p.patient_account_id IS NOT NULL
  AND p.id != p.patient_account_id;

UPDATE provider_documents pd
SET assigned_patient_id = p.patient_account_id
FROM patients p
WHERE pd.assigned_patient_id = p.id
  AND p.patient_account_id IS NOT NULL
  AND p.id != p.patient_account_id;

-- Step 3: Add new FK constraints pointing to patient_accounts
ALTER TABLE cart_lines 
  ADD CONSTRAINT cart_lines_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE CASCADE;

ALTER TABLE order_lines 
  ADD CONSTRAINT order_lines_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE CASCADE;

ALTER TABLE internal_messages 
  ADD CONSTRAINT internal_messages_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE SET NULL;

ALTER TABLE provider_document_patients 
  ADD CONSTRAINT provider_document_patients_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE CASCADE;

ALTER TABLE provider_documents 
  ADD CONSTRAINT provider_documents_assigned_patient_id_fkey 
    FOREIGN KEY (assigned_patient_id) REFERENCES patient_accounts(id) ON DELETE SET NULL;

-- Step 4: Drop patients table constraints
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_patient_account_id_fkey CASCADE;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_provider_id_fkey CASCADE;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_user_id_fkey CASCADE;

-- Step 5: Drop the patients table
DROP TABLE IF EXISTS patients CASCADE;

-- Step 6: Add documentation
COMMENT ON TABLE patient_accounts IS 'Consolidated patient data table. Previously split between patients and patient_accounts tables. Merged on 2025-11-01. Contains both patient demographic data and portal access information.';