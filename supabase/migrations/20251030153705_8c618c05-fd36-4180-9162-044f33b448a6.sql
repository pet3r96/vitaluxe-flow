-- Rework RLS policies on public.patient_documents to fix RLS violations and support impersonation
-- 1) Ensure RLS is enabled
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- 2) Drop existing policies to avoid conflicting semantics
DROP POLICY IF EXISTS "Admins can manage all patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Admins can manage documents during impersonation" ON public.patient_documents;
DROP POLICY IF EXISTS "Patients can delete their own documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Patients can insert their own documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Patients can manage their own documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Patients can update their own documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Patients can view their own documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Providers can view shared patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Providers can view their practice patients' documents" ON public.patient_documents;

-- 3) Create consolidated PERMISSIVE policies with OR semantics

-- SELECT: patients (own), admins (direct), admins (impersonating), providers (same practice)
CREATE POLICY "patient_docs_select_patient_or_provider_or_admin"
ON public.patient_documents
AS PERMISSIVE
FOR SELECT
TO public
USING (
  -- Patient sees their own docs
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = patient_documents.patient_id
      AND pa.user_id = auth.uid()
  )
  -- Admin direct
  OR has_role(auth.uid(), 'admin'::app_role)
  -- Admin during impersonation (only for that patient)
  OR EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    JOIN public.patient_accounts pa ON pa.user_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND pa.id = patient_documents.patient_id
  )
  -- Providers in same practice can view their practice patients' documents
  OR EXISTS (
    SELECT 1
    FROM public.patient_accounts pa
    JOIN public.providers p ON p.practice_id = pa.practice_id
    WHERE p.user_id = auth.uid()
      AND pa.id = patient_documents.patient_id
  )
);

-- INSERT: patients (own), admins (direct), admins (impersonating)
CREATE POLICY "patient_docs_insert_patient_or_admin"
ON public.patient_documents
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (
  -- Patient inserting their own doc
  patient_documents.patient_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
  -- Admin direct
  OR has_role(auth.uid(), 'admin'::app_role)
  -- Admin during impersonation for that patient
  OR EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    JOIN public.patient_accounts pa ON pa.user_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND pa.id = patient_documents.patient_id
  )
);

-- UPDATE: same actors as SELECT; row must remain valid after change
CREATE POLICY "patient_docs_update_patient_or_admin"
ON public.patient_documents
AS PERMISSIVE
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = patient_documents.patient_id
      AND pa.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    JOIN public.patient_accounts pa ON pa.user_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND pa.id = patient_documents.patient_id
  )
)
WITH CHECK (
  patient_documents.patient_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    JOIN public.patient_accounts pa ON pa.user_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND pa.id = patient_documents.patient_id
  )
);

-- DELETE: same actors as SELECT
CREATE POLICY "patient_docs_delete_patient_or_admin"
ON public.patient_documents
AS PERMISSIVE
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = patient_documents.patient_id
      AND pa.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    JOIN public.patient_accounts pa ON pa.user_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND pa.id = patient_documents.patient_id
  )
);
