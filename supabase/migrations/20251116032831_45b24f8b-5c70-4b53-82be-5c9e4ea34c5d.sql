
-- Migrate patient_messages using patient_id column (which is NOT NULL)
INSERT INTO patient_medical_vault (
  patient_id,
  patient_account_id,
  record_type,
  title,
  primary_value,
  description,
  date_recorded,
  metadata,
  created_at,
  updated_at
)
SELECT 
  pm.patient_id,
  pm.patient_id,
  'note',
  COALESCE(pm.subject, 'Patient Message'),
  pm.message_body,
  'Patient communication thread',
  pm.created_at::date,
  jsonb_build_object(
    'thread_id', pm.thread_id,
    'sender_id', pm.sender_id,
    'sender_type', pm.sender_type,
    'urgency', pm.urgency,
    'resolved', pm.resolved
  ),
  pm.created_at,
  pm.updated_at
FROM patient_messages pm
WHERE pm.patient_id IN (SELECT id FROM patient_accounts)
  AND NOT EXISTS (
    SELECT 1 FROM patient_medical_vault v
    WHERE v.patient_id = pm.patient_id
      AND v.record_type = 'note'
      AND v.primary_value = pm.message_body
      AND v.created_at = pm.created_at
  )
ON CONFLICT DO NOTHING;
