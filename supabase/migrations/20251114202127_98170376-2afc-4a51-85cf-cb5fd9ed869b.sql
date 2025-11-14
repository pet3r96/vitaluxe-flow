-- Backfill missing notification_preferences with default values
-- This ensures all users have complete preference rows for all event types

DO $$
DECLARE
  event_types TEXT[] := ARRAY[
    'new_message',
    'appointment_confirmation',
    'appointment_reschedule',
    'appointment_cancellation',
    'appointment_reminder',
    'order_shipped',
    'order_delivered',
    'order_updates',
    'payment_received',
    'payment_failed',
    'payment_updates',
    'subscription_updates',
    'system_alerts',
    'security_notifications',
    'form_assigned',
    'form_completed',
    'practice_announcements',
    'support_requests',
    'user_activity'
  ];
  event_type_val TEXT;
  user_id_val UUID;
BEGIN
  -- For each user in profiles
  FOR user_id_val IN 
    SELECT id FROM auth.users
  LOOP
    -- For each event type
    FOREACH event_type_val IN ARRAY event_types
    LOOP
      -- Insert if not exists (upsert with ON CONFLICT DO NOTHING)
      INSERT INTO notification_preferences (user_id, event_type, email_enabled, sms_enabled, in_app_enabled)
      VALUES (user_id_val, event_type_val, true, true, true)
      ON CONFLICT (user_id, event_type) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Backfilled notification preferences for all users';
END $$;