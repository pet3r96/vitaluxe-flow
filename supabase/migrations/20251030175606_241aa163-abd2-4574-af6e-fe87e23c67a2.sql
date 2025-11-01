-- Create RPC function to get provider documents (mirrors patient documents pattern)
CREATE OR REPLACE FUNCTION public.get_provider_documents(p_practice_id UUID)
RETURNS TABLE (
  id UUID,
  practice_id UUID,
  document_name TEXT,
  document_type TEXT,
  storage_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT,
  status TEXT,
  is_internal BOOLEAN,
  assigned_patient_id UUID,
  assigned_staff_id UUID,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.practice_id,
    pd.document_name,
    pd.document_type,
    pd.storage_path,
    pd.file_size::bigint,
    pd.mime_type,
    pd.notes,
    pd.status,
    pd.is_internal,
    pd.assigned_patient_id,
    pd.assigned_staff_id,
    pd.uploaded_by,
    pd.created_at,
    pd.updated_at
  FROM public.provider_documents pd
  WHERE pd.practice_id = p_practice_id
  ORDER BY pd.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_provider_documents(uuid) TO authenticated;