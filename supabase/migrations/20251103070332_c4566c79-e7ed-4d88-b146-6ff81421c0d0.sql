-- Add SELECT policy for patient_portal_terms so patients can read terms
CREATE POLICY "Authenticated users can view patient portal terms"
ON public.patient_portal_terms
FOR SELECT
TO authenticated
USING (true);