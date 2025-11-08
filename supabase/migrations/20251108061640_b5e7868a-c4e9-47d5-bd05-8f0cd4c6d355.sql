-- Phase 2: SMS Templates System
-- Create table for customizable SMS templates with token support
CREATE TABLE IF NOT EXISTS practice_sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('session_ready', 'session_reminder', 'session_cancelled')),
  message_template TEXT NOT NULL,
  available_tokens JSONB DEFAULT '["{{provider_name}}", "{{patient_name}}", "{{portal_link}}", "{{guest_link}}", "{{practice_name}}"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(practice_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_practice ON practice_sms_templates(practice_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_type ON practice_sms_templates(template_type);

-- Enable RLS
ALTER TABLE practice_sms_templates ENABLE ROW LEVEL SECURITY;

-- Allow practice owners and staff to view templates
CREATE POLICY "Practice members can view SMS templates"
  ON practice_sms_templates FOR SELECT
  USING (
    practice_id = auth.uid()
    OR practice_id IN (
      SELECT practice_id FROM providers WHERE user_id = auth.uid()
      UNION
      SELECT practice_id FROM practice_staff WHERE user_id = auth.uid()
    )
  );

-- Allow practice owners to insert/update templates
CREATE POLICY "Practice owners can manage SMS templates"
  ON practice_sms_templates FOR ALL
  USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());