-- Add in_app_enabled column to notification_preferences table
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN DEFAULT true;