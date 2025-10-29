-- Add performance indexes for patient dashboard queries
-- These will speed up patient data fetching significantly

-- Index for patient appointments by patient_id and start_time
CREATE INDEX IF NOT EXISTS idx_patient_appointments_patient_date 
ON public.patient_appointments(patient_id, start_time DESC)
WHERE start_time IS NOT NULL;

-- Index for unread patient messages
CREATE INDEX IF NOT EXISTS idx_patient_messages_unread 
ON public.patient_messages(patient_id, read_at)
WHERE read_at IS NULL;

-- Index for patient medical vault lookups
CREATE INDEX IF NOT EXISTS idx_patient_medical_vault_patient 
ON public.patient_medical_vault(patient_id, updated_at DESC);

-- Index for recent messages by patient (using created_at, not sent_at)
CREATE INDEX IF NOT EXISTS idx_patient_messages_recent
ON public.patient_messages(patient_id, created_at DESC);

COMMENT ON INDEX idx_patient_appointments_patient_date IS 'Speeds up patient appointment queries by date';
COMMENT ON INDEX idx_patient_messages_unread IS 'Optimizes unread message count queries';
COMMENT ON INDEX idx_patient_medical_vault_patient IS 'Improves medical vault retrieval';
COMMENT ON INDEX idx_patient_messages_recent IS 'Optimizes recent messages queries';