-- Drop the old status constraint
ALTER TABLE patient_appointments 
DROP CONSTRAINT IF EXISTS patient_appointments_status_check;

-- Add the new constraint with all status values including checked_in and being_treated
ALTER TABLE patient_appointments
ADD CONSTRAINT patient_appointments_status_check 
CHECK (status IN (
  'scheduled',
  'confirmed',
  'checked_in',
  'being_treated',
  'completed',
  'cancelled',
  'no_show'
));