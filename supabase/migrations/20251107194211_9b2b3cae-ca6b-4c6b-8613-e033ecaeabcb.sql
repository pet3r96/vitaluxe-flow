-- Add master notification controls to practice_automation_settings
ALTER TABLE practice_automation_settings 
ADD COLUMN IF NOT EXISTS enable_email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_sms_notifications BOOLEAN DEFAULT true;

COMMENT ON COLUMN practice_automation_settings.enable_email_notifications IS 'Master switch to enable/disable ALL email notifications for patients in this practice';
COMMENT ON COLUMN practice_automation_settings.enable_sms_notifications IS 'Master switch to enable/disable ALL SMS notifications for patients in this practice';