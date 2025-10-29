-- Create helper function to check if user can act on behalf of a practice
CREATE OR REPLACE FUNCTION public.can_act_for_practice(p_practice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    -- User is the practice owner
    auth.uid() = p_practice_id
    OR
    -- User is a provider for this practice
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE user_id = auth.uid() AND practice_id = p_practice_id
    )
    OR
    -- User is staff for this practice
    EXISTS (
      SELECT 1 FROM public.practice_staff
      WHERE user_id = auth.uid() AND practice_id = p_practice_id
    )
    OR
    -- Admin is impersonating this practice
    EXISTS (
      SELECT 1 FROM public.active_impersonation_sessions
      WHERE admin_user_id = auth.uid() 
        AND impersonated_user_id = p_practice_id
        AND expires_at > now()
    )
  );
END;
$$;

-- Apply RLS policies for practice_branding
DROP POLICY IF EXISTS "Users can view their own branding" ON public.practice_branding;
DROP POLICY IF EXISTS "Users can insert their own branding" ON public.practice_branding;
DROP POLICY IF EXISTS "Users can update their own branding" ON public.practice_branding;

CREATE POLICY "Practice branding select"
ON public.practice_branding FOR SELECT
USING (can_act_for_practice(practice_id));

CREATE POLICY "Practice branding insert"
ON public.practice_branding FOR INSERT
WITH CHECK (can_act_for_practice(practice_id));

CREATE POLICY "Practice branding update"
ON public.practice_branding FOR UPDATE
USING (can_act_for_practice(practice_id));

-- Apply RLS policies for provider_documents
DROP POLICY IF EXISTS "Users can view their own documents" ON public.provider_documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.provider_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.provider_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.provider_documents;

CREATE POLICY "Provider documents select"
ON public.provider_documents FOR SELECT
USING (can_act_for_practice(practice_id));

CREATE POLICY "Provider documents insert"
ON public.provider_documents FOR INSERT
WITH CHECK (can_act_for_practice(practice_id));

CREATE POLICY "Provider documents update"
ON public.provider_documents FOR UPDATE
USING (can_act_for_practice(practice_id));

CREATE POLICY "Provider documents delete"
ON public.provider_documents FOR DELETE
USING (can_act_for_practice(practice_id));

-- Apply RLS policies for practice_forms
DROP POLICY IF EXISTS "Users can view their own forms" ON public.practice_forms;
DROP POLICY IF EXISTS "Users can insert their own forms" ON public.practice_forms;
DROP POLICY IF EXISTS "Users can update their own forms" ON public.practice_forms;

CREATE POLICY "Practice forms select"
ON public.practice_forms FOR SELECT
USING (can_act_for_practice(practice_id));

CREATE POLICY "Practice forms insert"
ON public.practice_forms FOR INSERT
WITH CHECK (can_act_for_practice(practice_id));

CREATE POLICY "Practice forms update"
ON public.practice_forms FOR UPDATE
USING (can_act_for_practice(practice_id));

-- Apply RLS policies for patients (for visibility in dropdowns)
DROP POLICY IF EXISTS "Users can view their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON public.patients;

CREATE POLICY "Patients select"
ON public.patients FOR SELECT
USING (can_act_for_practice(practice_id));

CREATE POLICY "Patients insert"
ON public.patients FOR INSERT
WITH CHECK (can_act_for_practice(practice_id));

CREATE POLICY "Patients update"
ON public.patients FOR UPDATE
USING (can_act_for_practice(practice_id));

-- Storage policies for provider-documents bucket
-- Note: Storage policies use path-based checking
DROP POLICY IF EXISTS "Provider documents storage select" ON storage.objects;
DROP POLICY IF EXISTS "Provider documents storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Provider documents storage update" ON storage.objects;
DROP POLICY IF EXISTS "Provider documents storage delete" ON storage.objects;

CREATE POLICY "Provider documents storage select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'provider-documents' AND (
    -- Practice owner accessing their folder
    (name LIKE auth.uid()::text || '/%')
    OR
    -- Provider accessing their practice folder
    (name LIKE (SELECT practice_id::text FROM providers WHERE user_id = auth.uid()) || '/%')
    OR
    -- Staff accessing their practice folder
    (name LIKE (SELECT practice_id::text FROM practice_staff WHERE user_id = auth.uid()) || '/%')
    OR
    -- Admin impersonating practice
    (name LIKE (SELECT impersonated_user_id::text FROM active_impersonation_sessions WHERE admin_user_id = auth.uid() AND expires_at > now()) || '/%')
  )
);

CREATE POLICY "Provider documents storage insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'provider-documents' AND (
    (name LIKE auth.uid()::text || '/%')
    OR
    (name LIKE (SELECT practice_id::text FROM providers WHERE user_id = auth.uid()) || '/%')
    OR
    (name LIKE (SELECT practice_id::text FROM practice_staff WHERE user_id = auth.uid()) || '/%')
    OR
    (name LIKE (SELECT impersonated_user_id::text FROM active_impersonation_sessions WHERE admin_user_id = auth.uid() AND expires_at > now()) || '/%')
  )
);

CREATE POLICY "Provider documents storage update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'provider-documents' AND (
    (name LIKE auth.uid()::text || '/%')
    OR
    (name LIKE (SELECT practice_id::text FROM providers WHERE user_id = auth.uid()) || '/%')
    OR
    (name LIKE (SELECT practice_id::text FROM practice_staff WHERE user_id = auth.uid()) || '/%')
    OR
    (name LIKE (SELECT impersonated_user_id::text FROM active_impersonation_sessions WHERE admin_user_id = auth.uid() AND expires_at > now()) || '/%')
  )
);

CREATE POLICY "Provider documents storage delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'provider-documents' AND (
    (name LIKE auth.uid()::text || '/%')
    OR
    (name LIKE (SELECT practice_id::text FROM providers WHERE user_id = auth.uid()) || '/%')
    OR
    (name LIKE (SELECT practice_id::text FROM practice_staff WHERE user_id = auth.uid()) || '/%')
    OR
    (name LIKE (SELECT impersonated_user_id::text FROM active_impersonation_sessions WHERE admin_user_id = auth.uid() AND expires_at > now()) || '/%')
  )
);