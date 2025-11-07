-- Fix notification_templates schema
ALTER TABLE notification_templates 
  RENAME COLUMN type TO event_type;

ALTER TABLE notification_templates 
  RENAME COLUMN body TO message_template;

-- Add missing columns to notification_logs
ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS sender TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS recipient TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Set direction default for existing rows
UPDATE notification_logs SET direction = 'outbound' WHERE direction IS NULL;

-- Drop old redundant columns if they exist
ALTER TABLE notification_logs 
  DROP COLUMN IF EXISTS recipient_email,
  DROP COLUMN IF EXISTS recipient_phone;

-- Recreate notification_preferences with better structure
DROP TABLE IF EXISTS notification_preferences CASCADE;

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_type)
);

-- Enable RLS on notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own preferences
CREATE POLICY "Users can view their own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Add RLS policy for practice staff to view their practice logs (using user_roles table)
CREATE POLICY "Practice staff can view their practice logs"
  ON notification_logs FOR SELECT
  USING (
    practice_id IN (
      SELECT ps.practice_id 
      FROM practice_staff ps 
      WHERE ps.user_id = auth.uid() AND ps.active = true
    )
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'::app_role
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_practice_id 
  ON notification_logs(practice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_direction 
  ON notification_logs(direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type 
  ON notification_logs(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_event 
  ON notification_preferences(user_id, event_type);

-- Create updated_at trigger for notification_preferences
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();