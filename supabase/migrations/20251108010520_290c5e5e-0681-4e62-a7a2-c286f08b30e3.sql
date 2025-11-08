-- Add missing foreign key constraint for video_sessions -> patient_accounts
-- This fixes the query error causing appointments not to display

ALTER TABLE video_sessions
ADD CONSTRAINT video_sessions_patient_id_fkey 
FOREIGN KEY (patient_id) 
REFERENCES patient_accounts(id) 
ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_video_sessions_patient_id ON video_sessions(patient_id);