-- Initialize practice_automation_settings for all existing practices
-- Only insert if no settings exist for the practice
INSERT INTO practice_automation_settings (
  practice_id,
  enable_email_notifications,
  enable_sms_notifications
)
SELECT 
  p.id,
  true,  -- Enable email notifications by default
  true   -- Enable SMS notifications by default
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'doctor'
)
AND NOT EXISTS (
  SELECT 1 FROM practice_automation_settings pas 
  WHERE pas.practice_id = p.id
);