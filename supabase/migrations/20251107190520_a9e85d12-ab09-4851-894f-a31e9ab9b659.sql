-- Enable SMS notifications by default for all existing patient accounts
-- This updates notification preferences for users with the 'patient' role

UPDATE notification_preferences np
SET 
  sms_enabled = true,
  updated_at = now()
FROM user_roles ur
WHERE np.user_id = ur.user_id
  AND ur.role = 'patient'::app_role
  AND np.sms_enabled = false;