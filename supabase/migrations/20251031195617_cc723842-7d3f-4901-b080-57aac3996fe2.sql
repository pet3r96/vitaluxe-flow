-- Phase 1: Fix provider_document_patients to use patient_account_id

-- Step 1: Drop the old foreign key constraint
ALTER TABLE provider_document_patients 
DROP CONSTRAINT IF EXISTS provider_document_patients_patient_id_fkey;

-- Step 2: Update existing records to use patient_account_id
UPDATE provider_document_patients pdp
SET patient_id = v.patient_account_id
FROM v_patients_with_portal_status v
WHERE pdp.patient_id = v.patient_id
  AND v.patient_account_id IS NOT NULL;

-- Step 3: Create new foreign key constraint pointing to patient_accounts
ALTER TABLE provider_document_patients
ADD CONSTRAINT provider_document_patients_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE CASCADE;

-- Phase 4: Update get_provider_documents RPC to properly join with new patient system
DROP FUNCTION IF EXISTS get_provider_documents(uuid);

CREATE OR REPLACE FUNCTION get_provider_documents(p_practice_id uuid)
RETURNS TABLE (
  id uuid,
  practice_id uuid,
  document_name text,
  document_type text,
  storage_path text,
  file_size integer,
  mime_type text,
  tags text[],
  notes text,
  is_internal boolean,
  uploaded_at timestamptz,
  uploaded_by uuid,
  assigned_patient_id uuid,
  assigned_patient_names text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.id,
    pd.practice_id,
    pd.document_name,
    pd.document_type,
    pd.storage_path,
    pd.file_size,
    pd.mime_type,
    pd.tags,
    pd.notes,
    pd.is_internal,
    pd.uploaded_at,
    pd.uploaded_by,
    pd.assigned_patient_id,
    COALESCE(
      array_agg(DISTINCT pa.name) FILTER (WHERE pa.name IS NOT NULL),
      ARRAY[]::text[]
    ) as assigned_patient_names
  FROM provider_documents pd
  LEFT JOIN provider_document_patients pdp ON pd.id = pdp.document_id
  LEFT JOIN patient_accounts pa ON pdp.patient_id = pa.id
  WHERE pd.practice_id = p_practice_id
  GROUP BY pd.id;
END;
$$;