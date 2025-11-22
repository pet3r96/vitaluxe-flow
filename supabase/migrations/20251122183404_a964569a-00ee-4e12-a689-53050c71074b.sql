-- Fix duplicate cancellation SMS by skipping trigger notification for 'cancelled' status
-- The cancel-appointment edge function already sends detailed cancellation notifications

CREATE OR REPLACE FUNCTION notify_patient_of_appointment_update()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_email TEXT;
  v_patient_name TEXT;
  v_event_type TEXT;
  v_scheduled_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Skip if patient_id is NULL
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get patient details
  SELECT email, first_name || ' ' || last_name
  INTO v_patient_email, v_patient_name
  FROM patient_accounts
  WHERE id = NEW.patient_id;

  -- Only proceed if we have patient email
  IF v_patient_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine event type based on operation and status
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'appointment_scheduled';
    v_scheduled_time := NEW.scheduled_time;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' THEN
      -- Skip cancellation notifications - handled by cancel-appointment edge function
      RETURN NEW;
    ELSIF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
      v_event_type := 'appointment_confirmed';
      v_scheduled_time := NEW.scheduled_time;
    ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      v_event_type := 'appointment_completed';
      v_scheduled_time := NEW.scheduled_time;
    ELSE
      -- Other status changes don't trigger notifications
      RETURN NEW;
    END IF;
  END IF;

  -- Insert into notification queue
  INSERT INTO notification_queue (
    user_id,
    notification_type,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    NEW.patient_id,
    v_event_type,
    CASE 
      WHEN v_event_type = 'appointment_scheduled' THEN 'Appointment Scheduled'
      WHEN v_event_type = 'appointment_confirmed' THEN 'Appointment Confirmed'
      WHEN v_event_type = 'appointment_completed' THEN 'Appointment Completed'
    END,
    CASE 
      WHEN v_event_type = 'appointment_scheduled' THEN 
        'Your appointment has been scheduled for ' || to_char(v_scheduled_time, 'FMMonth DD, YYYY at HH12:MI AM')
      WHEN v_event_type = 'appointment_confirmed' THEN 
        'Your appointment on ' || to_char(v_scheduled_time, 'FMMonth DD, YYYY at HH12:MI AM') || ' has been confirmed'
      WHEN v_event_type = 'appointment_completed' THEN 
        'Your appointment has been completed. Thank you!'
    END,
    'appointment',
    NEW.id,
    jsonb_build_object(
      'patient_email', v_patient_email,
      'patient_name', v_patient_name,
      'scheduled_time', v_scheduled_time,
      'appointment_id', NEW.id,
      'practice_id', NEW.practice_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;