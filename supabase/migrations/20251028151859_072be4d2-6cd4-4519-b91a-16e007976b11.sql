-- Add columns to patient_messages for urgency and resolution tracking
ALTER TABLE patient_messages 
ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_messages_urgency ON patient_messages(urgency);
CREATE INDEX IF NOT EXISTS idx_patient_messages_resolved ON patient_messages(resolved);
CREATE INDEX IF NOT EXISTS idx_patient_messages_practice_resolved ON patient_messages(practice_id, resolved);

-- Add comment for documentation
COMMENT ON COLUMN patient_messages.urgency IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN patient_messages.resolved IS 'Whether the conversation has been resolved';
COMMENT ON COLUMN patient_messages.resolution_notes IS 'Optional notes about how the issue was resolved';