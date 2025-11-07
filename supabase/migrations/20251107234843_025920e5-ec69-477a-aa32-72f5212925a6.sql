-- Fix notify_patient_of_appointment_update to handle patients without portal accounts
CREATE OR REPLACE FUNCTION notify_patient_of_appointment_update()
RETURNS TRIGGER AS $$
DECLARE
  patient_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
  notification_type_val notification_type;
BEGIN
  -- Get patient's user_id
  SELECT user_id INTO patient_user_id
  FROM patient_accounts
  WHERE id = NEW.patient_id;
  
  -- Skip notification if patient doesn't have a portal account yet
  IF patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Determine notification type based on changes
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    notification_type_val := 'appointment_confirmed';
    notification_title := 'Appointment Confirmed';
    notification_message := 'Your appointment has been confirmed for ' || 
                           TO_CHAR(NEW.start_time, 'Mon DD, YYYY at HH:MI AM');
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    notification_type_val := 'appointment_confirmed';
    notification_title := 'Appointment Confirmed';
    notification_message := 'Your appointment for ' || 
                           TO_CHAR(NEW.start_time, 'Mon DD, YYYY at HH:MI AM') || 
                           ' has been confirmed';
  ELSIF TG_OP = 'UPDATE' AND OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    notification_type_val := 'appointment_rescheduled';
    notification_title := 'Appointment Rescheduled';
    notification_message := 'Your appointment has been rescheduled to ' || 
                           TO_CHAR(NEW.start_time, 'Mon DD, YYYY at HH:MI AM');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    notification_type_val := 'appointment_cancelled';
    notification_title := 'Appointment Cancelled';
    notification_message := 'Your appointment for ' || 
                           TO_CHAR(NEW.start_time, 'Mon DD, YYYY at HH:MI AM') || 
                           ' has been cancelled';
  ELSE
    RETURN NEW; -- No notification needed for other updates
  END IF;
  
  -- Create notification
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
    notification_title,
    notification_message,
    notification_type_val,
    CASE 
      WHEN notification_type_val = 'appointment_cancelled' THEN 'warning'
      ELSE 'info'
    END,
    'appointment',
    NEW.id,
    '/appointments'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;