-- Fix #1: Add missing foreign key constraint
ALTER TABLE patient_appointments
ADD CONSTRAINT patient_appointments_video_session_id_fkey 
  FOREIGN KEY (video_session_id) 
  REFERENCES video_sessions(id) 
  ON DELETE SET NULL;

-- Fix #2: Make appointment_id nullable for instant sessions
ALTER TABLE video_sessions
ALTER COLUMN appointment_id DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN video_sessions.appointment_id IS 'NULL for instant sessions, populated for scheduled appointments';