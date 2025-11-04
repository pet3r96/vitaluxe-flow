-- Fix 1: Add staff policies to patient_notes table (corrected column name)
CREATE POLICY "Staff can create notes for practice patients"
ON public.patient_notes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    JOIN public.patient_accounts pa ON pa.practice_id = ps.practice_id
    WHERE ps.user_id = auth.uid()
      AND ps.active = true
      AND pa.id = patient_notes.patient_account_id
  )
);

CREATE POLICY "Staff can update their practice patient notes"
ON public.patient_notes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    JOIN public.patient_accounts pa ON pa.practice_id = ps.practice_id
    WHERE ps.user_id = auth.uid()
      AND ps.active = true
      AND pa.id = patient_notes.patient_account_id
  )
);

-- Fix 2: Add staff INSERT policy to providers table
CREATE POLICY "Staff can create providers for their practice"
ON public.providers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = providers.practice_id
      AND ps.active = true
  )
);