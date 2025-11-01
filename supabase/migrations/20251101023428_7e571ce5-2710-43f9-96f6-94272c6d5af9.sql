-- Fix get_patient_unified_documents function with correct column names and JOIN logic
DROP FUNCTION IF EXISTS public.get_patient_unified_documents(uuid);

CREATE FUNCTION public.get_patient_unified_documents(p_patient_id uuid)
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
  status text,
  is_hidden boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Patient's own uploaded documents
  SELECT
    'patient_uploaded'::TEXT as source,
    pd.id,
    pd.patient_id,
    pd.document_name,
    pd.document_type,
    pd.created_at as uploaded_at,
    pd.file_size::BIGINT,
    pd.storage_path,
    pd.notes,
    pd.share_with_practice,
    pa.practice_id,
    pd.patient_id as uploader_id,
    CONCAT(pa.first_name, ' ', pa.last_name) as uploader_name,
    'patient'::TEXT as uploader_role,
    'active'::TEXT as status,
    COALESCE(pd.hidden_by_patient, false) as is_hidden

  FROM public.patient_documents pd
  JOIN public.patient_accounts pa ON pd.patient_id = pa.id
  WHERE pd.patient_id = p_patient_id
    AND COALESCE(pd.hidden_by_patient, false) = false

  UNION ALL

  -- Provider documents assigned to this patient (FIXED: Direct join without legacy patients table)
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
    COALESCE(prof.full_name, prof.name, 'Practice') as uploader_name,
    'practice'::TEXT as uploader_role,
    pvd.status,
    false as is_hidden
  FROM public.provider_documents pvd
  JOIN public.provider_document_patients pdp ON pvd.id = pdp.document_id
  LEFT JOIN public.profiles prof ON pvd.uploaded_by = prof.id
  WHERE pdp.patient_id = p_patient_id
    AND pvd.is_internal = false

  ORDER BY uploaded_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_unified_documents(uuid) TO authenticated, anon;