-- Comprehensive fix for all notification triggers to send email/SMS via send-notification edge function
-- This migration updates all 6 notification trigger functions to call send-notification after creating in-app notifications

-- 1. Update notify_order_status_change - Order status notifications
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  practice_user_id UUID;
  notification_type_val notification_type;
  notification_title TEXT;
  notification_severity TEXT;
  v_notification_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Get the practice user_id
    SELECT doctor_id INTO practice_user_id
    FROM public.orders
    WHERE id = NEW.order_id;
    
    -- Determine notification details
    notification_severity := 'info';
    
    CASE NEW.status::text
      WHEN 'shipped' THEN
        notification_type_val := 'order_shipped'::notification_type;
        notification_title := 'Order Shipped';
        notification_severity := 'success';
      WHEN 'delivered' THEN
        notification_type_val := 'order_delivered'::notification_type;
        notification_title := 'Order Delivered';
        notification_severity := 'success';
      WHEN 'cancelled' THEN
        notification_title := 'Order Cancelled';
        notification_severity := 'warning';
        notification_type_val := 'order_status'::notification_type;
      WHEN 'denied' THEN
        notification_title := 'Order Line Denied';
        notification_severity := 'error';
        notification_type_val := 'order_status'::notification_type;
      ELSE
        notification_type_val := 'order_status'::notification_type;
        notification_title := 'Order Status Updated';
    END CASE;
    
    -- Create notification and capture ID
    INSERT INTO public.notifications (
      user_id,
      notification_type,
      severity,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      practice_user_id,
      notification_type_val,
      notification_severity,
      notification_title,
      'Order line status changed to: ' || NEW.status::text || 
      CASE WHEN NEW.tracking_number IS NOT NULL 
        THEN ' (Tracking: ' || NEW.tracking_number || ')' 
        ELSE '' 
      END,
      'order_line',
      NEW.id,
      '/orders',
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_line_id', NEW.id,
        'old_status', OLD.status::text,
        'new_status', NEW.status::text,
        'tracking_number', NEW.tracking_number
      )
    ) RETURNING id INTO v_notification_id;
    
    -- Get Supabase configuration for calling edge function
    BEGIN
      v_supabase_url := current_setting('app.supabase_url', true);
      v_service_role_key := current_setting('app.supabase_service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not get Supabase settings for order notification: %', SQLERRM;
      RETURN NEW;
    END;
    
    -- Call send-notification edge function for email/SMS delivery
    IF v_notification_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'notification_id', v_notification_id,
            'send_email', true,
            'send_sms', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call send-notification for order: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Update notify_new_message - Message thread notifications (handles multiple recipients)
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_participants UUID[];
  participant_id UUID;
  thread_subject TEXT;
  thread_type_val TEXT;
  sender_name TEXT;
  v_notification_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Get thread details
  SELECT subject, thread_type INTO thread_subject, thread_type_val
  FROM public.message_threads
  WHERE id = NEW.thread_id;
  
  -- Get sender name
  SELECT name INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Get all participants except the sender
  SELECT ARRAY_AGG(tp.user_id) INTO thread_participants
  FROM public.thread_participants tp
  WHERE tp.thread_id = NEW.thread_id
    AND tp.user_id != NEW.sender_id;
  
  -- Get Supabase configuration once
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not get Supabase settings for message notification: %', SQLERRM;
  END;
  
  -- Create notification for each participant
  IF thread_participants IS NOT NULL THEN
    FOREACH participant_id IN ARRAY thread_participants
    LOOP
      INSERT INTO public.notifications (
        user_id,
        notification_type,
        severity,
        title,
        message,
        entity_type,
        entity_id,
        action_url,
        metadata
      ) VALUES (
        participant_id,
        CASE 
          WHEN thread_type_val = 'order_issue' THEN 'order_issue'::notification_type
          ELSE 'message'::notification_type
        END,
        'info',
        'New Message: ' || thread_subject,
        COALESCE(sender_name, 'Someone') || ' sent a message: ' || 
        LEFT(NEW.body, 100) || CASE WHEN LENGTH(NEW.body) > 100 THEN '...' ELSE '' END,
        'message_thread',
        NEW.thread_id,
        '/messages',
        jsonb_build_object(
          'sender_id', NEW.sender_id,
          'thread_type', thread_type_val,
          'thread_id', NEW.thread_id
        )
      ) RETURNING id INTO v_notification_id;
      
      -- Call send-notification for each recipient
      IF v_notification_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-notification',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_role_key
            ),
            body := jsonb_build_object(
              'notification_id', v_notification_id,
              'send_email', true,
              'send_sms', true
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Failed to call send-notification for message: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Update notify_internal_message - Internal message notifications (handles multiple recipients)
CREATE OR REPLACE FUNCTION public.notify_internal_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient RECORD;
  sender_name TEXT;
  patient_name TEXT;
  v_notification_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.created_by;
  
  IF NEW.patient_id IS NOT NULL THEN
    SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
  END IF;
  
  -- Get Supabase configuration once
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not get Supabase settings for internal message notification: %', SQLERRM;
  END;
  
  FOR recipient IN 
    SELECT recipient_id 
    FROM internal_message_recipients 
    WHERE message_id = NEW.id
    AND recipient_id != NEW.created_by
  LOOP
    INSERT INTO notifications (
      user_id,
      notification_type,
      severity,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      recipient.recipient_id,
      'info'::notification_type,
      CASE 
        WHEN NEW.priority = 'urgent' THEN 'error'
        WHEN NEW.priority = 'high' THEN 'warning'
        ELSE 'info'
      END,
      CASE 
        WHEN NEW.message_type = 'patient_specific' THEN 'Patient Message: ' || COALESCE(patient_name, 'Unknown')
        WHEN NEW.message_type = 'announcement' THEN 'Announcement: ' || NEW.subject
        ELSE 'Internal Message: ' || NEW.subject
      END,
      sender_name || ' sent a message',
      'internal_message',
      NEW.id,
      '/internal-chat?message=' || NEW.id,
      jsonb_build_object(
        'priority', NEW.priority,
        'message_type', NEW.message_type,
        'patient_id', NEW.patient_id
      )
    ) RETURNING id INTO v_notification_id;
    
    -- Call send-notification for each recipient
    IF v_notification_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'notification_id', v_notification_id,
            'send_email', true,
            'send_sms', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call send-notification for internal message: %', SQLERRM;
      END;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 4. Update notify_internal_message_reply - Internal message reply notifications (handles multiple recipients)
CREATE OR REPLACE FUNCTION public.notify_internal_message_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient RECORD;
  sender_name TEXT;
  msg_subject TEXT;
  original_sender UUID;
  v_notification_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT subject, created_by INTO msg_subject, original_sender 
  FROM internal_messages 
  WHERE id = NEW.message_id;
  
  -- Get Supabase configuration once
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not get Supabase settings for internal message reply notification: %', SQLERRM;
  END;
  
  -- Notify all recipients except the person who sent the reply
  FOR recipient IN 
    SELECT DISTINCT recipient_id 
    FROM internal_message_recipients 
    WHERE message_id = NEW.message_id
    AND recipient_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (
      user_id,
      notification_type,
      severity,
      title,
      message,
      entity_type,
      entity_id,
      action_url
    ) VALUES (
      recipient.recipient_id,
      'info'::notification_type,
      'info',
      'New Reply: ' || msg_subject,
      sender_name || ' replied',
      'internal_message',
      NEW.message_id,
      '/internal-chat?message=' || NEW.message_id
    ) RETURNING id INTO v_notification_id;
    
    -- Call send-notification for each recipient
    IF v_notification_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'notification_id', v_notification_id,
            'send_email', true,
            'send_sms', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call send-notification for reply: %', SQLERRM;
      END;
    END IF;
  END LOOP;
  
  -- ALSO notify the original sender if they're not the one replying
  IF original_sender != NEW.sender_id AND NOT EXISTS (
    SELECT 1 FROM internal_message_recipients 
    WHERE message_id = NEW.message_id AND recipient_id = original_sender
  ) THEN
    INSERT INTO notifications (
      user_id,
      notification_type,
      severity,
      title,
      message,
      entity_type,
      entity_id,
      action_url
    ) VALUES (
      original_sender,
      'info'::notification_type,
      'info',
      'New Reply: ' || msg_subject,
      sender_name || ' replied',
      'internal_message',
      NEW.message_id,
      '/internal-chat?message=' || NEW.message_id
    ) RETURNING id INTO v_notification_id;
    
    -- Call send-notification for original sender
    IF v_notification_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'notification_id', v_notification_id,
            'send_email', true,
            'send_sms', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call send-notification for reply to original sender: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Update notify_patient_of_practice_message - Practice to patient message notifications
CREATE OR REPLACE FUNCTION public.notify_patient_of_practice_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_user_id UUID;
  v_notification_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Only trigger for messages FROM practice TO patient
  IF NEW.sender_type = 'practice' THEN
    -- Get the patient's user_id
    SELECT user_id INTO patient_user_id
    FROM patient_accounts
    WHERE id = NEW.patient_id;
    
    -- Create notification and capture ID
    INSERT INTO notifications (
      user_id,
      title,
      message,
      notification_type,
      severity,
      entity_type,
      entity_id,
      action_url
    ) VALUES (
      patient_user_id,
      'New Message from Your Practice',
      CASE 
        WHEN LENGTH(COALESCE(NEW.subject, '')) > 0 THEN 'Subject: ' || NEW.subject
        ELSE 'You have received a new message'
      END,
      'practice_message_received',
      'info',
      'patient_message',
      NEW.id,
      '/messages'
    ) RETURNING id INTO v_notification_id;
    
    -- Get Supabase configuration
    BEGIN
      v_supabase_url := current_setting('app.supabase_url', true);
      v_service_role_key := current_setting('app.supabase_service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not get Supabase settings for patient message notification: %', SQLERRM;
      RETURN NEW;
    END;
    
    -- Call send-notification edge function
    IF v_notification_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'notification_id', v_notification_id,
            'send_email', true,
            'send_sms', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call send-notification for patient message: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Update notify_follow_up_assignment - Follow-up assignment notifications
CREATE OR REPLACE FUNCTION public.notify_follow_up_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_name TEXT;
  creator_name TEXT;
  v_notification_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Get patient name from patient_accounts
    SELECT CONCAT(first_name, ' ', last_name) INTO patient_name 
    FROM patient_accounts WHERE id = NEW.patient_id;
    
    SELECT name INTO creator_name FROM profiles WHERE id = NEW.created_by;
    
    -- Create notification and capture ID
    INSERT INTO notifications (
      user_id,
      title,
      message,
      notification_type,
      entity_type,
      entity_id,
      severity,
      metadata
    ) VALUES (
      NEW.assigned_to,
      'New Follow-Up Assigned',
      CONCAT('You have been assigned a follow-up for ', COALESCE(patient_name, 'a patient'), ' by ', COALESCE(creator_name, 'someone')),
      'follow_up_assigned',
      'patient_follow_ups',
      NEW.id,
      'info',
      jsonb_build_object(
        'patient_id', NEW.patient_id,
        'follow_up_date', NEW.follow_up_date,
        'priority', NEW.priority,
        'reason', NEW.reason
      )
    ) RETURNING id INTO v_notification_id;
    
    -- Get Supabase configuration
    BEGIN
      v_supabase_url := current_setting('app.supabase_url', true);
      v_service_role_key := current_setting('app.supabase_service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not get Supabase settings for follow-up notification: %', SQLERRM;
      RETURN NEW;
    END;
    
    -- Call send-notification edge function
    IF v_notification_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'notification_id', v_notification_id,
            'send_email', true,
            'send_sms', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call send-notification for follow-up: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.notify_order_status_change() IS 
'Creates in-app notification and triggers email/SMS delivery via send-notification edge function for order status changes';

COMMENT ON FUNCTION public.notify_new_message() IS 
'Creates in-app notifications and triggers email/SMS delivery via send-notification edge function for new messages';

COMMENT ON FUNCTION public.notify_internal_message() IS 
'Creates in-app notifications and triggers email/SMS delivery via send-notification edge function for internal messages';

COMMENT ON FUNCTION public.notify_internal_message_reply() IS 
'Creates in-app notifications and triggers email/SMS delivery via send-notification edge function for message replies';

COMMENT ON FUNCTION public.notify_patient_of_practice_message() IS 
'Creates in-app notification and triggers email/SMS delivery via send-notification edge function for patient messages';

COMMENT ON FUNCTION public.notify_follow_up_assignment() IS 
'Creates in-app notification and triggers email/SMS delivery via send-notification edge function for follow-up assignments';