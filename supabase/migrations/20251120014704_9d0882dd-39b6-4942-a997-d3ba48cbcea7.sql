-- Update notify_patient_of_appointment_update to use hardcoded Supabase URL
-- and handle missing app.* settings gracefully
CREATE OR REPLACE FUNCTION public.notify_patient_of_appointment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  patient_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
  v_supabase_url TEXT := 'https://qbtsfajshnrwwlfzkeog.supabase.co';
  v_service_role_key TEXT;
  v_request_id BIGINT;
  v_notification_id UUID;
BEGIN
  -- Only process confirmed or scheduled appointments
  IF TG_OP = 'INSERT' AND NEW.status NOT IN ('confirmed', 'scheduled') THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status AND OLD.start_time = NEW.start_time THEN
    RETURN NEW;
  END IF;

  -- Get patient details including user_id, email, and phone
  SELECT 
    pa.id,
    pa.user_id,
    pa.email,
    pa.phone,
    pa.first_name,
    pa.last_name
  INTO patient_record
  FROM patient_accounts pa
  WHERE pa.id = NEW.patient_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Patient account not found for appointment %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determine notification type and content
  IF TG_OP = 'INSERT' AND NEW.status IN ('confirmed', 'scheduled') THEN
    notification_type := 'appointment_confirmed';
    notification_title := 'Appointment Scheduled';
    notification_message := 'Your appointment has been scheduled for ' || 
                           TO_CHAR(NEW.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' THEN
    notification_type := 'appointment_cancelled';
    notification_title := 'Appointment Cancelled';
    notification_message := 'Your appointment scheduled for ' || 
                           TO_CHAR(OLD.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM') || 
                           ' has been cancelled';
  ELSIF TG_OP = 'UPDATE' AND NEW.start_time != OLD.start_time THEN
    notification_type := 'appointment_rescheduled';
    notification_title := 'Appointment Rescheduled';
    notification_message := 'Your appointment has been rescheduled to ' || 
                           TO_CHAR(NEW.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM');
  ELSE
    RETURN NEW;
  END IF;

  -- Create in-app notification if patient has portal access
  IF patient_record.user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        notification_type,
        severity,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        patient_record.user_id,
        notification_title,
        notification_message,
        notification_type::notification_type,
        'info',
        'appointment',
        NEW.id,
        jsonb_build_object(
          'appointment_id', NEW.id,
          'appointment_start', NEW.start_time,
          'patient_id', patient_record.id,
          'patient_name', CONCAT(patient_record.first_name, ' ', patient_record.last_name)
        )
      )
      RETURNING id INTO v_notification_id;
      
      RAISE NOTICE 'Created notification % for appointment %', v_notification_id, NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create notification for appointment %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- Call handleNotifications edge function via HTTP to send email/SMS
  -- Only if patient has email or phone
  IF patient_record.email IS NOT NULL OR patient_record.phone IS NOT NULL THEN
    BEGIN
      -- Try to get service role key from app settings (may not be set)
      BEGIN
        v_service_role_key := current_setting('app.supabase_service_role_key', true);
      EXCEPTION WHEN OTHERS THEN
        v_service_role_key := NULL;
      END;

      -- Only call edge function if we have the service role key
      IF v_service_role_key IS NOT NULL THEN
        SELECT extensions.http_post(
          url := v_supabase_url || '/functions/v1/handleNotifications',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'userId', patient_record.user_id,
            'eventType', notification_type,
            'notificationData', jsonb_build_object(
              'title', notification_title,
              'message', notification_message,
              'appointmentId', NEW.id,
              'appointmentStart', NEW.start_time,
              'patientEmail', patient_record.email,
              'patientPhone', patient_record.phone,
              'patientName', CONCAT(patient_record.first_name, ' ', patient_record.last_name)
            )
          )::text
        ) INTO v_request_id;
        
        RAISE NOTICE 'Called handleNotifications for appointment % (request_id: %)', NEW.id, v_request_id;
      ELSE
        RAISE WARNING 'Skipping edge function call - service role key not configured';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to call handleNotifications for appointment %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_notify_patient_appointment ON patient_appointments;
CREATE TRIGGER trigger_notify_patient_appointment
  AFTER INSERT OR UPDATE ON patient_appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_patient_of_appointment_update();