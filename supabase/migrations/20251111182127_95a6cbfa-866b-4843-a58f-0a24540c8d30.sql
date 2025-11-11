-- Fix notify_patient_of_practice_message to use patient_accounts.user_id instead of patient_accounts.id
CREATE OR REPLACE FUNCTION public.notify_patient_of_practice_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  practice_name TEXT;
  patient_user_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  -- Get the actual user_id from patient_accounts (patient_id is the patient_account.id)
  SELECT user_id INTO patient_user_id
  FROM patient_accounts
  WHERE id = NEW.patient_id;
  
  -- Use profiles table to get practice name
  SELECT name INTO practice_name
  FROM profiles
  WHERE id = NEW.practice_id;
  
  -- Send notification via handleNotifications using the actual user_id
  IF patient_user_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/handleNotifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'user_id', patient_user_id,
          'notification_type', 'practice_message_received',
          'title', 'New message from ' || COALESCE(practice_name, 'your provider'),
          'message', COALESCE(NEW.subject, 'You have a new message'),
          'metadata', jsonb_build_object(
            'thread_id', NEW.thread_id,
            'practice_id', NEW.practice_id
          ),
          'action_url', '/messages',
          'entity_type', 'practice_message',
          'entity_id', NEW.id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to call handleNotifications: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;