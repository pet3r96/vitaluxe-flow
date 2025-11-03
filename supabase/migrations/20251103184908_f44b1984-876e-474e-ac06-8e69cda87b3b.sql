-- Create RPC function to get provider documents for a specific patient
-- Handles permissions for admin, patient, and practice users
CREATE OR REPLACE FUNCTION public.get_patient_provider_documents(p_patient_id uuid)
RETURNS TABLE (
  id uuid,
  document_name text,
  document_type text,
  file_size bigint,
  mime_type text,
  storage_path text,
  status text,
  notes text,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  uploaded_by uuid,
  practice_id uuid,
  is_internal boolean,
  assigned_patient_id uuid,
  reviewed_at timestamptz,
  reviewed_by uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role app_role;
  v_patient_practice_id uuid;
  v_user_practice_id uuid;
BEGIN
  -- Get current user's role
  SELECT get_primary_role(auth.uid()) INTO v_user_role;
  
  -- Get the patient's practice ID
  SELECT practice_id INTO v_patient_practice_id
  FROM patient_accounts
  WHERE id = p_patient_id;
  
  -- Admin can view any patient's documents
  IF v_user_role = 'admin' THEN
    RETURN QUERY
    SELECT 
      pvd.id, pvd.document_name, pvd.document_type, pvd.file_size,
      pvd.mime_type, pvd.storage_path, pvd.status, pvd.notes,
      pvd.tags, pvd.created_at, pvd.updated_at, pvd.uploaded_by,
      pvd.practice_id, pvd.is_internal, 
      pvdp.patient_id as assigned_patient_id,
      pvd.reviewed_at, pvd.reviewed_by
    FROM provider_documents pvd
    INNER JOIN provider_document_patients pvdp ON pvd.id = pvdp.document_id
    WHERE pvdp.patient_id = p_patient_id
    ORDER BY pvd.created_at DESC;
    RETURN;
  END IF;
  
  -- Patient can view their own documents (non-internal only)
  IF v_user_role = 'patient' THEN
    -- Verify the patient is viewing their own documents
    IF EXISTS (
      SELECT 1 FROM patient_accounts
      WHERE id = p_patient_id AND user_id = auth.uid()
    ) THEN
      RETURN QUERY
      SELECT 
        pvd.id, pvd.document_name, pvd.document_type, pvd.file_size,
        pvd.mime_type, pvd.storage_path, pvd.status, pvd.notes,
        pvd.tags, pvd.created_at, pvd.updated_at, pvd.uploaded_by,
        pvd.practice_id, pvd.is_internal,
        pvdp.patient_id as assigned_patient_id,
        pvd.reviewed_at, pvd.reviewed_by
      FROM provider_documents pvd
      INNER JOIN provider_document_patients pvdp ON pvd.id = pvdp.document_id
      WHERE pvdp.patient_id = p_patient_id
        AND pvd.is_internal = false
      ORDER BY pvd.created_at DESC;
      RETURN;
    ELSE
      -- Patient trying to view another patient's documents
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  -- Practice users (doctor, staff, provider) can view documents for patients in their practice
  IF v_user_role IN ('doctor', 'staff', 'provider') THEN
    -- Get user's practice ID
    SELECT user_get_practice_id(auth.uid()) INTO v_user_practice_id;
    
    -- Verify patient belongs to user's practice
    IF v_user_practice_id = v_patient_practice_id THEN
      RETURN QUERY
      SELECT 
        pvd.id, pvd.document_name, pvd.document_type, pvd.file_size,
        pvd.mime_type, pvd.storage_path, pvd.status, pvd.notes,
        pvd.tags, pvd.created_at, pvd.updated_at, pvd.uploaded_by,
        pvd.practice_id, pvd.is_internal,
        pvdp.patient_id as assigned_patient_id,
        pvd.reviewed_at, pvd.reviewed_by
      FROM provider_documents pvd
      INNER JOIN provider_document_patients pvdp ON pvd.id = pvdp.document_id
      WHERE pvdp.patient_id = p_patient_id
        AND pvd.practice_id = v_user_practice_id
      ORDER BY pvd.created_at DESC;
      RETURN;
    ELSE
      -- User trying to access patient from another practice
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  -- All other roles denied
  RAISE EXCEPTION 'Access denied';
END;
$$;