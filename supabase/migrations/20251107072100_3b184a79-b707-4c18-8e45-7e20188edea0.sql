-- Add email_enabled and sms_enabled columns to admin_notification_preferences
ALTER TABLE public.admin_notification_preferences 
ADD COLUMN email_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN sms_enabled BOOLEAN NOT NULL DEFAULT true;

-- Drop the old enabled column
ALTER TABLE public.admin_notification_preferences 
DROP COLUMN enabled;