-- Consolidate provider_documents SELECT policy to eliminate recursion
-- Step 1: Drop patient-oriented SELECT policies that cause PostgREST to evaluate multiple policies
DROP POLICY IF EXISTS "Patients can view assigned documents" ON public.provider_documents;
DROP POLICY IF EXISTS "Patients can view assigned provider documents" ON public.provider_documents;

-- Step 2: Helper function for patient access without triggering RLS
CREATE OR REPLACE FUNCTION public.patient_can_view_provider_document(p_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM provider_document_patients pdp
    JOIN patient_accounts pa ON pa.id = pdp.patient_id
    WHERE pdp.document_id = p_document_id
      AND pa.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.patient_can_view_provider_document IS 'Checks if current user (patient) is assigned to provider document without triggering RLS';

-- Step 3: Replace SELECT policy with a single OR condition using security definer functions
DROP POLICY IF EXISTS "Provider documents select" ON public.provider_documents;
CREATE POLICY "Provider documents select"
ON public.provider_documents FOR SELECT
USING (
  user_can_access_practice_documents(practice_id)
  OR (
    is_internal = false
    AND patient_can_view_provider_document(id)
  )
);
