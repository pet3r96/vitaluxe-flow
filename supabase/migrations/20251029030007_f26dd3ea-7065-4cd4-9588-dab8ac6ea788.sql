-- Add new timestamp columns for check-in and treatment tracking
ALTER TABLE patient_appointments
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS treatment_started_at TIMESTAMPTZ;

-- Create index for faster querying of checked-in patients
CREATE INDEX IF NOT EXISTS idx_patient_appointments_checked_in 
ON patient_appointments(practice_id, status, checked_in_at) 
WHERE status = 'checked_in';

-- Add comment for documentation
COMMENT ON COLUMN patient_appointments.checked_in_at IS 'Timestamp when patient checked in for their appointment';
COMMENT ON COLUMN patient_appointments.treatment_started_at IS 'Timestamp when treatment/service started';