-- Fix get_provider_documents to use correct patient_accounts column names
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
SET search_path = public
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
    pd.created_at as uploaded_at,
    pd.uploaded_by,
    pd.assigned_patient_id,
    COALESCE(
      array_agg(DISTINCT CONCAT(pa.first_name, ' ', pa.last_name)) FILTER (WHERE pa.first_name IS NOT NULL),
      ARRAY[]::text[]
    ) as assigned_patient_names
  FROM provider_documents pd
  LEFT JOIN provider_document_patients pdp ON pd.id = pdp.document_id
  LEFT JOIN patient_accounts pa ON pdp.patient_id = pa.id
  WHERE pd.practice_id = p_practice_id
  GROUP BY pd.id, pd.practice_id, pd.document_name, pd.document_type, 
           pd.storage_path, pd.file_size, pd.mime_type, pd.tags, pd.notes,
           pd.is_internal, pd.created_at, pd.uploaded_by, pd.assigned_patient_id
  ORDER BY pd.created_at DESC;
END;
$$;