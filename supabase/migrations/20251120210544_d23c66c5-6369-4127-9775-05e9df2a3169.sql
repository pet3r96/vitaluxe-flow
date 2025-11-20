-- Fix notify_patient_of_practice_message to use correct column name (body not content)
CREATE OR REPLACE FUNCTION public.notify_patient_of_practice_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_patient_user_id UUID;
  v_practice_name TEXT;
BEGIN
  -- Only notify for new root messages from practice to patient
  IF NEW.parent_message_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Only notify if message is from practice
  IF NEW.sender_type != 'practice' THEN
    RETURN NEW;
  END IF;
  
  -- Get patient's user_id
  SELECT pa.user_id INTO v_patient_user_id
  FROM patient_accounts pa
  WHERE pa.id = NEW.patient_id;
  
  -- Skip if patient doesn't have portal access
  IF v_patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get practice name
  SELECT p.name INTO v_practice_name
  FROM profiles p
  WHERE p.id = NEW.practice_id;
  
  -- Queue notification
  INSERT INTO notification_queue (
    user_id,
    notification_type,
    title,
    message,
    metadata,
    action_url,
    entity_type,
    entity_id
  ) VALUES (
    v_patient_user_id,
    'message_received',
    'New Message from ' || COALESCE(v_practice_name, 'Your Practice'),
    COALESCE(NEW.subject || ': ', '') || LEFT(NEW.body, 150),
    jsonb_build_object(
      'message_id', NEW.id,
      'practice_id', NEW.practice_id,
      'patient_id', NEW.patient_id
    ),
    '/patient/messages',
    'patient_message',
    NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$;