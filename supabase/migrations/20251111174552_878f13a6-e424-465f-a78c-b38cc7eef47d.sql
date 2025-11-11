-- Create notification_logs table for delivery tracking
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid,
  channel text CHECK (channel IN ('sms','email','in_app')),
  status text CHECK (status IN ('sent','failed','skipped')),
  external_id text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel_status ON notification_logs(channel, status);

-- Consolidate practice_sms_templates into notification_templates
INSERT INTO notification_templates (
  practice_id,
  event_type,
  channel,
  message_template,
  variables,
  is_default,
  active
)
SELECT 
  practice_id,
  template_type,
  'sms',
  message_template,
  available_tokens::jsonb,
  false,
  is_active
FROM practice_sms_templates
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.practice_id = practice_sms_templates.practice_id
    AND nt.event_type = practice_sms_templates.template_type
    AND nt.channel = 'sms'
)
ON CONFLICT (practice_id, event_type, channel) DO NOTHING;

-- Drop old table after migration
DROP TABLE IF EXISTS practice_sms_templates CASCADE;