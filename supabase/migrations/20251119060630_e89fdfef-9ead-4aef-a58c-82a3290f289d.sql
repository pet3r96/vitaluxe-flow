-- Add missing SELECT policies for 100% RLS coverage

-- 1. cert_rotation_schedule: Admin-only access
CREATE POLICY "Admins can select cert rotation schedule"
ON public.cert_rotation_schedule
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. provider_document_assignments: Admins and practice owners can view assignments
CREATE POLICY "Admins and practice owners can select document assignments"
ON public.provider_document_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM provider_documents pd
    WHERE pd.id = provider_document_assignments.document_id
      AND pd.practice_id = auth.uid()
  )
);

-- 3. provider_documents: Admins and practice owners can view their documents
CREATE POLICY "Admins and practice owners can select documents"
ON public.provider_documents
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR practice_id = auth.uid()
);