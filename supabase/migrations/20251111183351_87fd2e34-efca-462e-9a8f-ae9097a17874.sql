-- Allow 'in_app' channel in notification_logs
ALTER TABLE notification_logs 
DROP CONSTRAINT IF EXISTS notification_logs_channel_check;

ALTER TABLE notification_logs 
ADD CONSTRAINT notification_logs_channel_check 
CHECK (channel IN ('email', 'sms', 'in_app'));