-- Drop old e-commerce notification preferences table
DROP TABLE IF EXISTS public.notification_preferences CASCADE;

-- Create new healthcare notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true NOT NULL,
  sms_enabled BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT notification_preferences_user_type_unique UNIQUE (user_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences"
  ON public.notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();