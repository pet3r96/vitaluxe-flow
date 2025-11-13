-- Add video_session_id column to patient_appointments table
ALTER TABLE patient_appointments
ADD COLUMN video_session_id UUID;

-- Add foreign key constraint to video_sessions table
ALTER TABLE patient_appointments
ADD CONSTRAINT fk_video_session 
  FOREIGN KEY (video_session_id) 
  REFERENCES video_sessions(id) 
  ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_patient_appointments_video_session 
  ON patient_appointments(video_session_id);

-- Add comment for documentation
COMMENT ON COLUMN patient_appointments.video_session_id IS 'Links appointment to video_sessions table for scheduled video calls';