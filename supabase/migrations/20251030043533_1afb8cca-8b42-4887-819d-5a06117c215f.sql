-- Add thread_id column to patient_messages for conversation threading
ALTER TABLE patient_messages 
ADD COLUMN thread_id uuid;

-- Add index for performance
CREATE INDEX idx_patient_messages_thread_id ON patient_messages(thread_id);

-- Add comment for documentation
COMMENT ON COLUMN patient_messages.thread_id IS 'Groups messages into conversation threads. First message in thread has thread_id = id, replies reference the original thread_id.';

-- Set thread_id = id for all existing messages (makes them standalone threads)
UPDATE patient_messages 
SET thread_id = id 
WHERE thread_id IS NULL;