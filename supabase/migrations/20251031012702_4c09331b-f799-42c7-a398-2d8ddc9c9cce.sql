-- Add free-text prescriber column so users can enter a name or leave none
ALTER TABLE public.patient_medications
ADD COLUMN IF NOT EXISTS prescribing_provider text;

-- Policy: allow practice staff to manage medications for patients in their practice
DROP POLICY IF EXISTS "Practice staff can manage patient medications" ON public.patient_medications;
CREATE POLICY "Practice staff can manage patient medications"
ON public.patient_medications
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.practice_staff ps
    JOIN public.patient_accounts pa ON pa.practice_id = ps.practice_id
    WHERE ps.user_id = auth.uid()
      AND pa.id = patient_medications.patient_account_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.practice_staff ps
    JOIN public.patient_accounts pa ON pa.practice_id = ps.practice_id
    WHERE ps.user_id = auth.uid()
      AND pa.id = patient_medications.patient_account_id
  )
);