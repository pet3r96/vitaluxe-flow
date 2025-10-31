-- Drop and recreate get_provider_documents to include patient-shared documents
DROP FUNCTION IF EXISTS public.get_provider_documents(uuid);

CREATE OR REPLACE FUNCTION public.get_provider_documents(p_practice_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Return unified documents from provider_documents AND patient_documents (shared with practice)
  SELECT json_agg(row_to_json(combined_docs.*))
  INTO result
  FROM (
    -- Provider documents (practice-uploaded)
    SELECT 
      pd.id,
      pd.document_name,
      pd.document_type,
      pd.storage_path,
      pd.practice_id,
      pd.uploaded_by,
      pd.created_at,
      pd.updated_at,
      pd.status,
      pd.tags,
      pd.notes,
      pd.is_internal,
      pd.file_size,
      pd.mime_type,
      pd.assigned_staff_id,
      pd.reviewed_by,
      pd.reviewed_at,
      'provider' as source_type,
      NULL::UUID as patient_uploader_id,
      (
        SELECT json_agg(row_to_json(pdp.*))
        FROM provider_document_patients pdp
        WHERE pdp.document_id = pd.id
      ) as provider_document_patients,
      (
        SELECT row_to_json(up.*)
        FROM profiles up
        WHERE up.id = pd.uploaded_by
      ) as uploader_profile
    FROM provider_documents pd
    WHERE pd.practice_id = p_practice_id
    
    UNION ALL
    
    -- Patient documents (patient-uploaded and shared with practice)
    SELECT 
      ptd.id,
      COALESCE(ptd.custom_title, ptd.document_name) as document_name,
      ptd.document_type,
      ptd.storage_path,
      pa.practice_id,
      ptd.uploaded_by,
      ptd.created_at,
      ptd.updated_at,
      'uploaded' as status,
      NULL::text[] as tags,
      ptd.notes,
      false as is_internal,
      ptd.file_size,
      ptd.mime_type,
      NULL::UUID as assigned_staff_id,
      NULL::UUID as reviewed_by,
      NULL::timestamptz as reviewed_at,
      'patient' as source_type,
      ptd.patient_id as patient_uploader_id,
      NULL::json as provider_document_patients,
      (
        SELECT row_to_json(up.*)
        FROM profiles up
        WHERE up.id = ptd.uploaded_by
      ) as uploader_profile
    FROM patient_documents ptd
    JOIN patient_accounts pa ON pa.id = ptd.patient_id
    WHERE pa.practice_id = p_practice_id 
      AND ptd.share_with_practice = true
      AND ptd.hidden_by_patient = false
    
    ORDER BY created_at DESC
  ) combined_docs;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;