-- Update all notification triggers to call handleNotifications function

-- 1. Update notify_new_message trigger
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_user_id UUID;
  sender_name TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  SELECT COALESCE(name, 'Someone') INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;
  
  FOR participant_user_id IN
    SELECT user_id FROM message_participants
    WHERE thread_id = NEW.thread_id
    AND user_id != NEW.sender_id
  LOOP
    IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/handleNotifications',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'user_id', participant_user_id,
            'notification_type', 'message',
            'title', 'New Message',
            'message', sender_name || ': ' || LEFT(NEW.content, 100),
            'metadata', jsonb_build_object(
              'thread_id', NEW.thread_id,
              'message_id', NEW.id,
              'sender_id', NEW.sender_id
            ),
            'action_url', '/messages',
            'entity_type', 'message',
            'entity_id', NEW.id
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call handleNotifications: %', SQLERRM;
      END;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 2. Update notify_patient_of_practice_message trigger
CREATE OR REPLACE FUNCTION public.notify_patient_of_practice_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  practice_name TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  SELECT name INTO practice_name
  FROM practices
  WHERE id = NEW.practice_id;
  
  IF NEW.patient_user_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/handleNotifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.patient_user_id,
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

-- 3. Update notify_order_status_change trigger
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  practice_user_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT doctor_id INTO practice_user_id FROM orders WHERE id = NEW.order_id;
    
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
    
    IF practice_user_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/handleNotifications',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'user_id', practice_user_id,
            'notification_type', 
              CASE NEW.status::text
                WHEN 'shipped' THEN 'order_shipped'
                WHEN 'delivered' THEN 'order_delivered'
                ELSE 'order_status'
              END,
            'title', 
              CASE NEW.status::text
                WHEN 'shipped' THEN 'Order Shipped'
                WHEN 'delivered' THEN 'Order Delivered'
                ELSE 'Order Status Updated'
              END,
            'message', 'Order line status changed to: ' || NEW.status::text,
            'metadata', jsonb_build_object(
              'order_id', NEW.order_id,
              'order_line_id', NEW.id,
              'old_status', OLD.status::text,
              'new_status', NEW.status::text,
              'tracking_number', NEW.tracking_number
            ),
            'action_url', '/orders',
            'entity_type', 'order_line',
            'entity_id', NEW.id
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call handleNotifications: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Update notify_follow_up_assignment trigger
CREATE OR REPLACE FUNCTION public.notify_follow_up_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_user_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  SELECT user_id INTO patient_user_id
  FROM patient_accounts
  WHERE id = NEW.patient_id;
  
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
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
          'notification_type', 'follow_up_assigned',
          'title', 'New Follow-up Assigned',
          'message', COALESCE(NEW.notes, 'You have a new follow-up task'),
          'metadata', jsonb_build_object(
            'follow_up_id', NEW.id,
            'patient_id', NEW.patient_id,
            'due_date', NEW.due_date
          ),
          'action_url', '/follow-ups',
          'entity_type', 'follow_up',
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

-- 5. Update notify_internal_message trigger
CREATE OR REPLACE FUNCTION public.notify_internal_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_user_id UUID;
  sender_name TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  SELECT COALESCE(name, 'Someone') INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;
  
  SELECT user_id INTO recipient_user_id
  FROM practice_accounts
  WHERE id = NEW.recipient_id;
  
  IF recipient_user_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/handleNotifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'user_id', recipient_user_id,
          'notification_type', 'message',
          'title', 'New Internal Message',
          'message', sender_name || ': ' || LEFT(NEW.message, 100),
          'metadata', jsonb_build_object(
            'message_id', NEW.id,
            'sender_id', NEW.sender_id,
            'recipient_id', NEW.recipient_id
          ),
          'action_url', '/internal-messages',
          'entity_type', 'internal_message',
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

-- 6. Update notify_internal_message_reply trigger
CREATE OR REPLACE FUNCTION public.notify_internal_message_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_sender_id UUID;
  original_sender_user_id UUID;
  replier_name TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  SELECT sender_id INTO original_sender_id
  FROM internal_messages
  WHERE id = NEW.parent_message_id;
  
  SELECT user_id INTO original_sender_user_id
  FROM practice_accounts
  WHERE id = original_sender_id;
  
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  SELECT COALESCE(name, 'Someone') INTO replier_name
  FROM profiles
  WHERE id = (SELECT user_id FROM practice_accounts WHERE id = NEW.sender_id);
  
  IF original_sender_user_id IS NOT NULL AND NEW.sender_id != original_sender_id AND v_supabase_url IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/handleNotifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'user_id', original_sender_user_id,
          'notification_type', 'message',
          'title', 'New Reply to Your Message',
          'message', replier_name || ': ' || LEFT(NEW.message, 100),
          'metadata', jsonb_build_object(
            'message_id', NEW.id,
            'parent_message_id', NEW.parent_message_id,
            'sender_id', NEW.sender_id
          ),
          'action_url', '/internal-messages',
          'entity_type', 'internal_message',
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

-- 7. Update notify_patient_of_appointment_update trigger (if exists)
CREATE OR REPLACE FUNCTION public.notify_patient_of_appointment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_user_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  SELECT user_id INTO patient_user_id
  FROM patient_accounts
  WHERE id = NEW.patient_id;
  
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  IF patient_user_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/handleNotifications',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'user_id', patient_user_id,
            'notification_type', 
              CASE NEW.status
                WHEN 'confirmed' THEN 'appointment_confirmed'
                WHEN 'cancelled' THEN 'appointment_cancelled'
                ELSE 'appointment_update'
              END,
            'title', 'Appointment ' || INITCAP(NEW.status::text),
            'message', 'Your appointment status has been updated to: ' || NEW.status::text,
            'metadata', jsonb_build_object(
              'appointment_id', NEW.id,
              'old_status', OLD.status::text,
              'new_status', NEW.status::text
            ),
            'action_url', '/appointments',
            'entity_type', 'appointment',
            'entity_id', NEW.id
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call handleNotifications: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;