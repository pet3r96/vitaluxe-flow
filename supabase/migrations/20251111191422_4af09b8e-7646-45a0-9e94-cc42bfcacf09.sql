-- Update notify_patient_of_appointment_update to integrate with handleNotifications
CREATE OR REPLACE FUNCTION notify_patient_of_appointment_update()
RETURNS TRIGGER AS $$
DECLARE
  patient_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_twilio_sid TEXT;
  v_twilio_auth TEXT;
  v_twilio_messaging_sid TEXT;
  v_postmark_api_key TEXT;
  http_response RECORD;
BEGIN
  -- Fetch complete patient data including portal user_id and contact info
  SELECT 
    pa.user_id, 
    pa.email, 
    pa.phone, 
    pa.first_name, 
    pa.last_name,
    pa.id as patient_account_id
  INTO patient_record
  FROM patient_accounts pa
  WHERE pa.id = NEW.patient_id;
  
  -- Determine notification details based on what changed
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    notification_type := 'appointment_confirmed';
    notification_title := 'Appointment Confirmed';
    notification_message := 'Your appointment has been confirmed for ' || 
                           TO_CHAR(NEW.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM');
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    notification_type := 'appointment_confirmed';
    notification_title := 'Appointment Confirmed';
    notification_message := 'Your appointment for ' || 
                           TO_CHAR(NEW.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM') || 
                           ' has been confirmed';
  ELSIF TG_OP = 'UPDATE' AND OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    notification_type := 'appointment_rescheduled';
    notification_title := 'Appointment Rescheduled';
    notification_message := 'Your appointment has been rescheduled to ' || 
                           TO_CHAR(NEW.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    notification_type := 'appointment_cancelled';
    notification_title := 'Appointment Cancelled';
    notification_message := 'Your appointment for ' || 
                           TO_CHAR(NEW.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM') || 
                           ' has been cancelled';
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'scheduled' THEN
    notification_type := 'appointment_confirmed';
    notification_title := 'Appointment Scheduled';
    notification_message := 'Your appointment has been scheduled for ' || 
                           TO_CHAR(NEW.start_time AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH:MI AM');
  ELSE
    RETURN NEW; -- No notification needed for other updates
  END IF;
  
  -- Get Supabase credentials for calling edge function
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  IF patient_record.user_id IS NOT NULL AND v_supabase_url IS NOT NULL THEN
    -- Patient has portal account - use handleNotifications (email + SMS + in-app)
    BEGIN
      SELECT * INTO http_response FROM net.http_post(
        url := v_supabase_url || '/functions/v1/handleNotifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'user_id', patient_record.user_id,
          'notification_type', notification_type,
          'title', notification_title,
          'message', notification_message,
          'metadata', jsonb_build_object(
            'appointment_id', NEW.id,
            'appointment_time', NEW.start_time,
            'practice_id', NEW.practice_id
          ),
          'action_url', '/appointments',
          'entity_type', 'appointment',
          'entity_id', NEW.id
        )
      );
      RAISE LOG 'Appointment notification sent via handleNotifications for user_id %', patient_record.user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to call handleNotifications for appointment: %', SQLERRM;
    END;
  ELSIF patient_record.email IS NOT NULL OR patient_record.phone IS NOT NULL THEN
    -- Patient has NO portal account - direct email/SMS fallback
    RAISE LOG 'Appointment notification fallback: patient % has no user_id', patient_record.patient_account_id;
    
    -- Get API credentials
    v_postmark_api_key := current_setting('app.postmark_api_key', true);
    v_twilio_sid := current_setting('app.twilio_account_sid', true);
    v_twilio_auth := current_setting('app.twilio_auth_token', true);
    v_twilio_messaging_sid := current_setting('app.twilio_messaging_service_sid', true);
    
    -- Send email if available
    IF patient_record.email IS NOT NULL AND v_postmark_api_key IS NOT NULL THEN
      BEGIN
        SELECT * INTO http_response FROM net.http_post(
          url := 'https://api.postmarkapp.com/email',
          headers := jsonb_build_object(
            'Accept', 'application/json',
            'Content-Type', 'application/json',
            'X-Postmark-Server-Token', v_postmark_api_key
          ),
          body := jsonb_build_object(
            'From', 'notifications@vitaluxeservices.com',
            'To', patient_record.email,
            'Subject', notification_title,
            'HtmlBody', '<h2>' || notification_title || '</h2><p>' || notification_message || '</p>',
            'TextBody', notification_title || E'\n\n' || notification_message,
            'MessageStream', 'outbound'
          )
        );
        RAISE LOG 'Fallback email sent to % for appointment %', patient_record.email, NEW.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send fallback email for appointment: %', SQLERRM;
      END;
    END IF;
    
    -- Send SMS if available
    IF patient_record.phone IS NOT NULL AND v_twilio_sid IS NOT NULL THEN
      DECLARE
        normalized_phone TEXT;
        sms_body TEXT;
      BEGIN
        -- Normalize phone to E.164
        normalized_phone := CASE
          WHEN patient_record.phone ~ '^\+' THEN patient_record.phone
          WHEN length(regexp_replace(patient_record.phone, '[^0-9]', '', 'g')) = 10 
            THEN '+1' || regexp_replace(patient_record.phone, '[^0-9]', '', 'g')
          WHEN length(regexp_replace(patient_record.phone, '[^0-9]', '', 'g')) = 11 
            AND patient_record.phone ~ '^1'
            THEN '+' || regexp_replace(patient_record.phone, '[^0-9]', '', 'g')
          ELSE '+' || regexp_replace(patient_record.phone, '[^0-9]', '', 'g')
        END;
        
        sms_body := notification_title || E'\n\n' || notification_message;
        
        SELECT * INTO http_response FROM net.http_post(
          url := 'https://api.twilio.com/2010-04-01/Accounts/' || v_twilio_sid || '/Messages.json',
          headers := jsonb_build_object(
            'Content-Type', 'application/x-www-form-urlencoded',
            'Authorization', 'Basic ' || encode(v_twilio_sid || ':' || v_twilio_auth, 'base64')
          ),
          body := 'MessagingServiceSid=' || v_twilio_messaging_sid || 
                  '&To=' || normalized_phone || 
                  '&Body=' || sms_body
        );
        RAISE LOG 'Fallback SMS sent to % for appointment %', normalized_phone, NEW.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send fallback SMS for appointment: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_notify_patient_appointment ON patient_appointments;
CREATE TRIGGER trigger_notify_patient_appointment
  AFTER INSERT OR UPDATE ON patient_appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_patient_of_appointment_update();