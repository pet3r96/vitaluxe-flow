-- Fix get_patient_unified_documents to include is_hidden field
DROP FUNCTION IF EXISTS public.get_patient_unified_documents(uuid);

CREATE OR REPLACE FUNCTION public.get_patient_unified_documents(p_patient_id uuid)
RETURNS TABLE(
  source text,
  id uuid,
  patient_id uuid,
  document_name text,
  document_type text,
  uploaded_at timestamp with time zone,
  file_size bigint,
  storage_path text,
  notes text,
  share_with_practice boolean,
  practice_id uuid,
  uploader_id uuid,
  uploader_name text,
  uploader_role text,
  is_hidden boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Patient's own documents from patient_medical_vault
  SELECT
    'patient_uploaded'::TEXT as source,
    pmv.id,
    pmv.patient_account_id as patient_id,
    COALESCE(
      (pmv.record_data->>'document_name')::TEXT,
      pmv.title
    ) as document_name,
    COALESCE((pmv.record_data->>'document_type')::TEXT, 'other') as document_type,
    pmv.created_at as uploaded_at,
    COALESCE((pmv.record_data->>'file_size')::BIGINT, 0) as file_size,
    (pmv.record_data->>'storage_path')::TEXT as storage_path,
    COALESCE((pmv.record_data->>'notes')::TEXT, '') as notes,
    COALESCE((pmv.record_data->>'share_with_practice')::BOOLEAN, false) as share_with_practice,
    pmv.practice_id,
    pmv.created_by_user_id as uploader_id,
    pa.first_name || ' ' || pa.last_name as uploader_name,
    'patient'::TEXT as uploader_role,
    NOT pmv.active as is_hidden
  FROM public.patient_medical_vault pmv
  JOIN public.patient_accounts pa ON pmv.patient_account_id = pa.id
  WHERE pmv.patient_account_id = p_patient_id
    AND pmv.record_type = 'document'
    AND pmv.active = true

  UNION ALL

  -- Provider documents assigned to patient
  SELECT
    'provider_assigned'::TEXT as source,
    pvd.id,
    p_patient_id as patient_id,
    pvd.document_name,
    pvd.document_type,
    pvd.created_at as uploaded_at,
    pvd.file_size::BIGINT,
    pvd.storage_path,
    pvd.notes,
    true as share_with_practice,
    pvd.practice_id,
    pvd.uploaded_by as uploader_id,
    COALESCE(prof.name, 'Practice') as uploader_name,
    'practice'::TEXT as uploader_role,
    COALESCE(pvd.is_hidden, false) as is_hidden
  FROM public.provider_documents pvd
  JOIN public.provider_document_patients pdp ON pvd.id = pdp.document_id
  LEFT JOIN public.profiles prof ON pvd.uploaded_by = prof.id
  WHERE pdp.patient_id = p_patient_id
    AND pvd.is_internal = false

  ORDER BY uploaded_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_unified_documents(uuid) TO authenticated, anon;