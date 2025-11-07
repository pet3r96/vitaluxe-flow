-- Allow 'video' as a valid visit_type for patient_appointments
ALTER TABLE patient_appointments 
DROP CONSTRAINT IF EXISTS patient_appointments_visit_type_check;

ALTER TABLE patient_appointments 
ADD CONSTRAINT patient_appointments_visit_type_check 
CHECK (visit_type = ANY (ARRAY['in_person'::text, 'virtual'::text, 'video'::text]));