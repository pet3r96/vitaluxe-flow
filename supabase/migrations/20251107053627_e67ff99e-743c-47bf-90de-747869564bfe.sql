-- Create notification templates table
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(practice_id, type, channel)
);

-- Create notification logs table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  external_id TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  appointment_reminders BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  marketing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_templates
CREATE POLICY "Admins can manage all templates"
  ON public.notification_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can view their templates"
  ON public.notification_templates FOR SELECT
  USING (practice_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can manage their templates"
  ON public.notification_templates FOR ALL
  USING (practice_id = auth.uid());

-- RLS Policies for notification_logs
CREATE POLICY "Admins can view all logs"
  ON public.notification_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own logs"
  ON public.notification_logs FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for notification_preferences
CREATE POLICY "Users can manage their own preferences"
  ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all preferences"
  ON public.notification_preferences FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id ON public.notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_external_id ON public.notification_logs(external_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_practice_type ON public.notification_templates(practice_id, type);

-- Insert default templates
INSERT INTO public.notification_templates (type, channel, subject, body, is_default, active, variables) VALUES
('appointment_reminder', 'email', 'Appointment Reminder - {{practice_name}}', 'Hi {{first_name}},\n\nThis is a reminder that you have an appointment with {{provider_name}} at {{practice_name}} on {{appointment_date}} at {{appointment_time}}.\n\nIf you need to reschedule, please contact us.\n\nThank you,\n{{practice_name}}', true, true, '["first_name", "last_name", "practice_name", "provider_name", "appointment_date", "appointment_time"]'::jsonb),
('appointment_reminder', 'sms', NULL, 'Appointment reminder: {{appointment_date}} at {{appointment_time}} with {{provider_name}}. Reply STOP to opt out.', true, true, '["first_name", "last_name", "practice_name", "provider_name", "appointment_date", "appointment_time"]'::jsonb),
('order_confirmation', 'email', 'Order Confirmation - {{practice_name}}', 'Hi {{first_name}},\n\nYour order #{{order_id}} has been confirmed.\n\nThank you,\n{{practice_name}}', true, true, '["first_name", "last_name", "practice_name", "order_id"]'::jsonb),
('order_confirmation', 'sms', NULL, 'Your order #{{order_id}} has been confirmed. Reply STOP to opt out.', true, true, '["first_name", "last_name", "practice_name", "order_id"]'::jsonb)
ON CONFLICT DO NOTHING;