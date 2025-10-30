-- Add UPDATE policy for patients to request reschedules on their own appointments
CREATE POLICY "Patients can update their own appointment reschedule requests"
ON public.patient_appointments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts
    WHERE patient_accounts.id = patient_appointments.patient_id
    AND patient_accounts.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patient_accounts
    WHERE patient_accounts.id = patient_appointments.patient_id
    AND patient_accounts.user_id = auth.uid()
  )
);

-- Create validation function to protect core appointment fields from patient updates
CREATE OR REPLACE FUNCTION public.validate_patient_reschedule_update()
RETURNS TRIGGER AS $$
DECLARE
  is_patient BOOLEAN;
BEGIN
  -- Check if the current user is a patient (not admin/provider)
  SELECT EXISTS (
    SELECT 1 FROM public.patient_accounts
    WHERE patient_accounts.id = NEW.patient_id
    AND patient_accounts.user_id = auth.uid()
  ) INTO is_patient;

  -- If user is a patient, restrict what they can update
  IF is_patient THEN
    -- Patients cannot modify these core fields
    IF OLD.patient_id != NEW.patient_id OR
       OLD.practice_id != NEW.practice_id OR
       OLD.provider_id != NEW.provider_id OR
       OLD.room_id IS DISTINCT FROM NEW.room_id OR
       OLD.start_time != NEW.start_time OR
       OLD.end_time != NEW.end_time OR
       OLD.appointment_type != NEW.appointment_type THEN
      RAISE EXCEPTION 'Patients cannot modify core appointment fields';
    END IF;

    -- Patients can only set status to 'pending' when requesting reschedule
    IF NEW.status != 'pending' AND NEW.status != OLD.status THEN
      RAISE EXCEPTION 'Patients can only set status to pending';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate patient updates
CREATE TRIGGER validate_patient_reschedule_update_trigger
  BEFORE UPDATE ON public.patient_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_patient_reschedule_update();