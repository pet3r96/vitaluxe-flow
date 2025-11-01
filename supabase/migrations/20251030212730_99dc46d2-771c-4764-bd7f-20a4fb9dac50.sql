-- Add 'pending' status to patient_appointments status check constraint
ALTER TABLE public.patient_appointments
DROP CONSTRAINT IF EXISTS patient_appointments_status_check;

ALTER TABLE public.patient_appointments
ADD CONSTRAINT patient_appointments_status_check 
CHECK (status IN (
  'pending',
  'scheduled', 
  'confirmed', 
  'checked_in',
  'being_treated',
  'cancelled', 
  'completed', 
  'no_show'
));

-- Add 'patient_request' and 'walk_in' to appointment_type check constraint
ALTER TABLE public.patient_appointments
DROP CONSTRAINT IF EXISTS patient_appointments_appointment_type_check;

ALTER TABLE public.patient_appointments
ADD CONSTRAINT patient_appointments_appointment_type_check 
CHECK (appointment_type IN (
  'consultation',
  'follow_up',
  'procedure',
  'telehealth',
  'patient_request',
  'walk_in',
  'other'
));