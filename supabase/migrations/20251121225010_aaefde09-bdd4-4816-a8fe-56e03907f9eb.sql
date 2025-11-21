-- Fix duplicate SMS for instant video sessions
-- Skip "Appointment Scheduled" notification when edge function already sends "Video Session Ready"

CREATE OR REPLACE FUNCTION public.notify_patient_of_appointment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_patient_user_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Handle INSERT (new appointment scheduled)
  IF TG_OP = 'INSERT' THEN
    -- Skip notification for instant video sessions
    -- Edge function handles this with "Video Session Ready" notification
    IF NEW.notes = 'Created instantly by provider/staff' THEN
      RETURN NEW;
    END IF;
    
    v_notification_title := 'Appointment Scheduled';
    v_notification_message := 'Your appointment has been scheduled for ' || 
      TO_CHAR(NEW.start_time, 'FMMonth DD, YYYY at HH12:MI AM');
    
  -- Handle UPDATE (status changes only)
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only notify on status changes
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
    
    -- Set notification content based on new status
    CASE NEW.status
      WHEN 'confirmed' THEN
        v_notification_title := 'Appointment Confirmed';
        v_notification_message := 'Your appointment has been confirmed for ' || 
          TO_CHAR(NEW.start_time, 'FMMonth DD, YYYY at HH12:MI AM');
      WHEN 'cancelled' THEN
        v_notification_title := 'Appointment Cancelled';
        v_notification_message := 'Your appointment scheduled for ' || 
          TO_CHAR(NEW.start_time, 'FMMonth DD, YYYY at HH12:MI AM') || ' has been cancelled';
      WHEN 'completed' THEN
        v_notification_title := 'Appointment Completed';
        v_notification_message := 'Your appointment has been completed';
      ELSE
        -- Don't notify for other status transitions
        RETURN NEW;
    END CASE;
  ELSE
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
  
  -- Queue notification for processing
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
    'appointment_reminder',
    v_notification_title,
    v_notification_message,
    jsonb_build_object(
      'appointment_id', NEW.id,
      'status', NEW.status,
      'appointment_time', NEW.start_time,
      'service_type', NEW.service_type
    ),
    '/patient/appointments',
    'appointment',
    NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$;