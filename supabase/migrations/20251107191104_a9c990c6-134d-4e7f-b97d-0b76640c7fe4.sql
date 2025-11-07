-- Initialize notification preferences for all users without them
-- This ensures all users can receive notifications with role-appropriate defaults

-- Create a function to get role-based default preferences
CREATE OR REPLACE FUNCTION get_default_notification_settings(user_role app_role)
RETURNS TABLE(email_enabled boolean, sms_enabled boolean, in_app_enabled boolean) AS $$
BEGIN
  -- Patients get SMS by default, others don't
  RETURN QUERY SELECT 
    false AS email_enabled,
    CASE WHEN user_role = 'patient' THEN true ELSE false END AS sms_enabled,
    true AS in_app_enabled;
END;
$$ LANGUAGE plpgsql;

-- Insert default preferences for all users who don't have any preferences yet
-- We create preferences for each event type
INSERT INTO notification_preferences (user_id, event_type, email_enabled, sms_enabled, in_app_enabled)
SELECT 
  ur.user_id,
  event_type,
  defaults.email_enabled,
  defaults.sms_enabled,
  defaults.in_app_enabled
FROM user_roles ur
CROSS JOIN LATERAL get_default_notification_settings(ur.role) AS defaults
CROSS JOIN (
  SELECT unnest(ARRAY[
    'appointment_reminder',
    'appointment_confirmation', 
    'appointment_cancellation',
    'appointment_reschedule',
    'new_message',
    'form_assigned',
    'form_completed',
    'prescription_ready',
    'order_shipped',
    'order_delivered',
    'payment_received',
    'payment_failed'
  ]) AS event_type
) AS event_types
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences np 
  WHERE np.user_id = ur.user_id
)
ON CONFLICT (user_id, event_type) DO NOTHING;