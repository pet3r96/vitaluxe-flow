-- Drop old function
DROP FUNCTION IF EXISTS public.get_provider_documents(uuid);

-- Create new function that returns JSONB with nested relationships
CREATE OR REPLACE FUNCTION public.get_provider_documents(p_practice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pd.id,
      'practice_id', pd.practice_id,
      'document_name', pd.document_name,
      'document_type', pd.document_type,
      'storage_path', pd.storage_path,
      'file_size', pd.file_size,
      'mime_type', pd.mime_type,
      'notes', pd.notes,
      'status', pd.status,
      'is_internal', pd.is_internal,
      'assigned_patient_id', pd.assigned_patient_id,
      'assigned_staff_id', pd.assigned_staff_id,
      'uploaded_by', pd.uploaded_by,
      'tags', pd.tags,
      'created_at', pd.created_at,
      'updated_at', pd.updated_at,
      
      -- Join assigned patient (single)
      'patients', CASE 
        WHEN pd.assigned_patient_id IS NOT NULL THEN
          (SELECT jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email)
           FROM patients p WHERE p.id = pd.assigned_patient_id)
        ELSE NULL
      END,
      
      -- Join multiple patients via provider_document_patients
      'provider_document_patients', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'patient_id', pdp.patient_id,
            'assigned_by', pdp.assigned_by,
            'message', pdp.message,
            'patients', jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'email', p.email
            )
          )
        ), '[]'::jsonb)
        FROM provider_document_patients pdp
        LEFT JOIN patients p ON p.id = pdp.patient_id
        WHERE pdp.document_id = pd.id
      ),
      
      -- Join uploader profile
      'uploader_profile', CASE
        WHEN pd.uploaded_by IS NOT NULL THEN
          (SELECT jsonb_build_object('id', prof.id, 'full_name', prof.full_name, 'email', prof.email)
           FROM profiles prof WHERE prof.id = pd.uploaded_by)
        ELSE NULL
      END
    )
    ORDER BY pd.created_at DESC
  ) INTO result
  FROM provider_documents pd
  WHERE pd.practice_id = p_practice_id;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_documents(uuid) TO authenticated;