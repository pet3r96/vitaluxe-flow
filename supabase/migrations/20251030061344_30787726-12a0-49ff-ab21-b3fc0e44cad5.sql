-- Fix notify_internal_message trigger to remove category column and fix entity_id
CREATE OR REPLACE FUNCTION public.notify_internal_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient RECORD;
  sender_name TEXT;
  patient_name TEXT;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.created_by;
  
  IF NEW.patient_id IS NOT NULL THEN
    SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
  END IF;
  
  FOR recipient IN 
    SELECT recipient_id 
    FROM internal_message_recipients 
    WHERE message_id = NEW.id
    AND recipient_id != NEW.created_by  -- Don't notify the sender
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
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix notify_internal_message_reply trigger to remove category column and fix entity_id
CREATE OR REPLACE FUNCTION public.notify_internal_message_reply()
RETURNS TRIGGER AS $$
DECLARE
  recipient RECORD;
  sender_name TEXT;
  msg_subject TEXT;
  original_sender UUID;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT subject, created_by INTO msg_subject, original_sender 
  FROM internal_messages 
  WHERE id = NEW.message_id;
  
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
    );
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
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;