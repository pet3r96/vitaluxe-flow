-- Fix patient-documents storage RLS to support regular and impersonated uploads
-- Drop existing policies that we're replacing
DROP POLICY IF EXISTS "Patients can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Patients can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Providers can view patient documents" ON storage.objects;
DROP POLICY IF EXISTS "Patients can delete their own documents" ON storage.objects;

-- 1) Patients: INSERT (self) - supports both user_id and patient_account_id folders
CREATE POLICY "Patient docs insert (self)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND (
    -- Folder is the authenticated user's id
    ( (storage.foldername(name))[1] = auth.uid()::text )
    OR
    -- OR folder is the patient's account id for this user
    EXISTS (
      SELECT 1 FROM public.patient_accounts pa
      WHERE pa.user_id = auth.uid()
        AND pa.id::text = (storage.foldername(name))[1]
    )
  )
);

-- 2) Patients: SELECT (self)
CREATE POLICY "Patient docs select (self)"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    ( (storage.foldername(name))[1] = auth.uid()::text )
    OR
    EXISTS (
      SELECT 1 FROM public.patient_accounts pa
      WHERE pa.user_id = auth.uid()
        AND pa.id::text = (storage.foldername(name))[1]
    )
  )
);

-- 3) Patients: DELETE (self)
CREATE POLICY "Patient docs delete (self)"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    ( (storage.foldername(name))[1] = auth.uid()::text )
    OR
    EXISTS (
      SELECT 1 FROM public.patient_accounts pa
      WHERE pa.user_id = auth.uid()
        AND pa.id::text = (storage.foldername(name))[1]
    )
  )
);

-- 4) Admins during impersonation: INSERT
CREATE POLICY "Patient docs insert (admin impersonating)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND (
        -- Folder equals the impersonated user's id
        ( (storage.foldername(name))[1] = ais.impersonated_user_id::text )
        OR
        -- Or folder equals that user's patient_account id
        EXISTS (
          SELECT 1 FROM public.patient_accounts pa
          WHERE pa.user_id = ais.impersonated_user_id
            AND pa.id::text = (storage.foldername(name))[1]
        )
      )
  )
);

-- 5) Admins during impersonation: SELECT
CREATE POLICY "Patient docs select (admin impersonating)"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND (
        ( (storage.foldername(name))[1] = ais.impersonated_user_id::text )
        OR EXISTS (
          SELECT 1 FROM public.patient_accounts pa
          WHERE pa.user_id = ais.impersonated_user_id
            AND pa.id::text = (storage.foldername(name))[1]
        )
      )
  )
);

-- 6) Admins during impersonation: DELETE
CREATE POLICY "Patient docs delete (admin impersonating)"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND (
        ( (storage.foldername(name))[1] = ais.impersonated_user_id::text )
        OR EXISTS (
          SELECT 1 FROM public.patient_accounts pa
          WHERE pa.user_id = ais.impersonated_user_id
            AND pa.id::text = (storage.foldername(name))[1]
        )
      )
  )
);

-- 7) Providers: SELECT shared patient docs only, and only for their practice
CREATE POLICY "Providers can view shared patient documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1
    FROM public.patient_documents pd
    JOIN public.patient_accounts pa ON pa.id = pd.patient_id
    WHERE pd.storage_path = storage.objects.name
      AND pd.share_with_practice = true
      AND pa.practice_id IN (
        SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
      )
  )
);