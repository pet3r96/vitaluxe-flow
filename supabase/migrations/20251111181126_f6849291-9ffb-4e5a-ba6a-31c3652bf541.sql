-- Fix notify_patient_of_practice_message trigger to use profiles table
CREATE OR REPLACE FUNCTION public.notify_patient_of_practice_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  practice_name TEXT;
  patient_email TEXT;
  patient_phone TEXT;
BEGIN
  -- Get practice name from profiles table
  SELECT name INTO practice_name 
  FROM profiles 
  WHERE id = NEW.practice_id;
  
  -- Get patient contact info
  SELECT email, phone INTO patient_email, patient_phone
  FROM patient_accounts
  WHERE id = NEW.patient_id;
  
  -- Log notification event
  INSERT INTO audit_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    details
  ) VALUES (
    NEW.practice_id,
    'patient_message_sent',
    'patient_messages',
    NEW.id,
    jsonb_build_object(
      'patient_id', NEW.patient_id,
      'practice_name', practice_name,
      'message_preview', LEFT(NEW.message, 50)
    )
  );
  
  RETURN NEW;
END;
$function$;