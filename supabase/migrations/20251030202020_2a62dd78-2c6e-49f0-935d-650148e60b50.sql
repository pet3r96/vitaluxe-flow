-- Add INSERT policy for patient_appointments to allow patients to request their own appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'patient_appointments' 
      AND policyname = 'Patients can request appointments'
  ) THEN
    CREATE POLICY "Patients can request appointments"
    ON public.patient_appointments
    FOR INSERT
    WITH CHECK (
      patient_id IN (
        SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
      )
      AND practice_id = (
        SELECT practice_id FROM public.patient_accounts WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;
