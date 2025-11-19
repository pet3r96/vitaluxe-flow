
-- Drop the CHECK constraint that's blocking appointment creation
-- This constraint expects old enum values but we're now using service type IDs
ALTER TABLE patient_appointments 
DROP CONSTRAINT IF EXISTS valid_service_type;

-- Make service_type column more flexible to handle both IDs and legacy values
COMMENT ON COLUMN patient_appointments.service_type 
IS 'Stores service type ID from appointment_service_types table or legacy enum values';
