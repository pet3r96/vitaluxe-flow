-- Add patient-specific notification types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'practice_message_received') THEN
    ALTER TYPE notification_type ADD VALUE 'practice_message_received';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'appointment_confirmed') THEN
    ALTER TYPE notification_type ADD VALUE 'appointment_confirmed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'appointment_rescheduled') THEN
    ALTER TYPE notification_type ADD VALUE 'appointment_rescheduled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'appointment_cancelled') THEN
    ALTER TYPE notification_type ADD VALUE 'appointment_cancelled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'document_assigned') THEN
    ALTER TYPE notification_type ADD VALUE 'document_assigned';
  END IF;
END $$;

-- Create trigger function for practice messages to patients
CREATE OR REPLACE FUNCTION notify_patient_of_practice_message()
RETURNS TRIGGER AS $$
DECLARE
  patient_user_id UUID;
BEGIN
  -- Only trigger for messages FROM practice TO patient
  IF NEW.sender_type = 'practice' THEN
    -- Get the patient's user_id
    SELECT user_id INTO patient_user_id
    FROM patient_accounts
    WHERE id = NEW.patient_id;
    
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
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_notify_patient_message ON patient_messages;
CREATE TRIGGER trigger_notify_patient_message
AFTER INSERT ON patient_messages
FOR EACH ROW
EXECUTE FUNCTION notify_patient_of_practice_message();

-- Create trigger function for appointment updates
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_notify_patient_appointment ON patient_appointments;
CREATE TRIGGER trigger_notify_patient_appointment
AFTER INSERT OR UPDATE ON patient_appointments
FOR EACH ROW
EXECUTE FUNCTION notify_patient_of_appointment_update();