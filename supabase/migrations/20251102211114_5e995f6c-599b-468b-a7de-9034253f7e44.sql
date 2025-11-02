-- Fix get_provider_documents function to handle missing columns in patient_documents table
DROP FUNCTION IF EXISTS get_provider_documents(uuid);

CREATE OR REPLACE FUNCTION public.get_provider_documents(p_practice_id uuid)
RETURNS TABLE(
  id uuid,
  practice_id uuid,
  document_name text,
  document_type text,
  storage_path text,
  file_size integer,
  mime_type text,
  tags text[],
  notes text,
  status text,
  is_internal boolean,
  uploaded_at timestamp with time zone,
  uploaded_by uuid,
  assigned_patient_id uuid,
  assigned_patient_names text[],
  assigned_patient_ids uuid[],
  source_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  -- Provider documents
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
    pd.status,
    pd.is_internal,
    pd.created_at as uploaded_at,
    pd.uploaded_by,
    pd.assigned_patient_id,
    COALESCE(
      array_agg(DISTINCT CONCAT(pa.first_name, ' ', pa.last_name)) FILTER (WHERE pa.first_name IS NOT NULL),
      ARRAY[]::text[]
    ) as assigned_patient_names,
    COALESCE(
      array_agg(DISTINCT pa.id) FILTER (WHERE pa.id IS NOT NULL),
      ARRAY[]::uuid[]
    ) as assigned_patient_ids,
    'provider'::text as source_type
  FROM provider_documents pd
  LEFT JOIN provider_document_patients pdp ON pd.id = pdp.document_id
  LEFT JOIN patient_accounts pa ON pdp.patient_id = pa.id
  WHERE pd.practice_id = p_practice_id
  GROUP BY pd.id
  
  UNION ALL
  
  -- Patient-shared documents (use default values for missing columns)
  SELECT 
    pat_doc.id,
    pat_acct.practice_id,
    pat_doc.document_name,
    pat_doc.document_type,
    pat_doc.storage_path,
    pat_doc.file_size,
    pat_doc.mime_type,
    ARRAY[]::text[] as tags,  -- patient_documents doesn't have tags column
    pat_doc.notes,
    'uploaded'::text as status,  -- patient_documents doesn't have status column
    false as is_internal,
    pat_doc.created_at as uploaded_at,
    pat_doc.uploaded_by,
    pat_doc.patient_id as assigned_patient_id,
    ARRAY[CONCAT(pat_acct.first_name, ' ', pat_acct.last_name)]::text[] as assigned_patient_names,
    ARRAY[pat_acct.id]::uuid[] as assigned_patient_ids,
    'patient_shared'::text as source_type
  FROM patient_documents pat_doc
  INNER JOIN patient_accounts pat_acct ON pat_doc.patient_id = pat_acct.id
  WHERE pat_acct.practice_id = p_practice_id
    AND pat_doc.share_with_practice = true
  
  ORDER BY uploaded_at DESC;
END;
$function$;