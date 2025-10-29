-- Add completed_at column to patient_appointments table
ALTER TABLE patient_appointments 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;