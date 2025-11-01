-- Create RPC function to fetch unified documents
CREATE OR REPLACE FUNCTION public.get_patient_unified_documents(p_patient_id UUID)
RETURNS TABLE (
  source TEXT,
  id UUID,
  patient_id UUID,
  document_name TEXT,
  document_type TEXT,
  storage_path TEXT,
  bucket_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT,
  share_with_practice BOOLEAN,
  custom_title TEXT,
  hidden_by_patient BOOLEAN,
  is_provider_document BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  assigned_by UUID,
  assignment_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'patient_upload'::TEXT as source,
    pd.id,
    pd.patient_id,
    pd.document_name,
    pd.document_type,
    pd.storage_path,
    'patient-documents'::TEXT as bucket_name,
    pd.file_size,
    pd.mime_type,
    pd.notes,
    pd.share_with_practice,
    pd.custom_title,
    pd.hidden_by_patient,
    false as is_provider_document,
    pd.created_at,
    pd.updated_at,
    NULL::UUID as assigned_by,
    NULL::TEXT as assignment_message
  FROM public.patient_documents pd
  WHERE pd.patient_id = p_patient_id AND pd.hidden_by_patient = false

  UNION ALL

  SELECT
    'provider_assigned'::TEXT as source,
    pvd.id,
    pdp.patient_id,
    pvd.document_name,
    pvd.document_type,
    pvd.storage_path,
    'provider-documents'::TEXT as bucket_name,
    pvd.file_size,
    pvd.mime_type,
    pvd.notes,
    true as share_with_practice,
    NULL::TEXT as custom_title,
    false as hidden_by_patient,
    true as is_provider_document,
    pvd.created_at,
    pvd.updated_at,
    pdp.assigned_by,
    pdp.message as assignment_message
  FROM public.provider_documents pvd
  JOIN public.provider_document_patients pdp ON pvd.id = pdp.document_id
  WHERE pdp.patient_id = p_patient_id
    AND pvd.is_internal = false
    AND pvd.status <> 'uploaded'
  
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;