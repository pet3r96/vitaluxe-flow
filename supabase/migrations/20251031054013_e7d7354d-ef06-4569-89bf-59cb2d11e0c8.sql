-- Drop the existing trigger functions
DROP FUNCTION IF EXISTS notify_appointment_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_patient_message_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_document_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_subscription_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_order_status_alert() CASCADE;

-- Recreate notify_appointment_alert to insert directly into alerts table
CREATE OR REPLACE FUNCTION notify_appointment_alert()
RETURNS TRIGGER AS $$
DECLARE
  event_name TEXT;
  alert_message TEXT;
  practice_id_var UUID;
BEGIN
  -- Determine event type and message
  IF TG_OP = 'INSERT' THEN
    event_name := 'appointment_new';
    alert_message := 'New appointment created';
    practice_id_var := NEW.practice_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status AND NEW.status = 'cancelled' THEN
      event_name := 'appointment_canceled';
      alert_message := 'Appointment was cancelled';
      practice_id_var := NEW.practice_id;
    ELSIF OLD.start_time != NEW.start_time OR OLD.end_time != NEW.end_time THEN
      event_name := 'appointment_modified';
      alert_message := 'Appointment time was modified';
      practice_id_var := NEW.practice_id;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN OLD;
  END IF;

  -- Insert alert directly into alerts table
  INSERT INTO alerts (
    event_type, severity, message, details, practice_id, created_at
  ) VALUES (
    event_name,
    'low',
    alert_message,
    jsonb_build_object(
      'appointment_id', COALESCE(NEW.id, OLD.id),
      'patient_id', COALESCE(NEW.patient_id, OLD.patient_id),
      'provider_id', COALESCE(NEW.provider_id, OLD.provider_id),
      'start_time', COALESCE(NEW.start_time, OLD.start_time),
      'status', COALESCE(NEW.status, OLD.status)
    ),
    practice_id_var,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_patient_message_alert
CREATE OR REPLACE FUNCTION notify_patient_message_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for messages from patients
  IF NEW.sender_role = 'patient' THEN
    INSERT INTO alerts (
      event_type, severity, message, details, practice_id, created_at
    ) VALUES (
      'patient_message',
      'low',
      'New message received from patient',
      jsonb_build_object(
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'practice_id', NEW.practice_id,
        'subject', NEW.subject
      ),
      NEW.practice_id,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_document_alert
CREATE OR REPLACE FUNCTION notify_document_alert()
RETURNS TRIGGER AS $$
DECLARE
  practice_id_var UUID;
BEGIN
  -- Get practice_id from patient_accounts
  SELECT practice_id INTO practice_id_var
  FROM patient_accounts
  WHERE id = NEW.patient_id;

  -- Only trigger for new uploads
  IF TG_OP = 'INSERT' AND practice_id_var IS NOT NULL THEN
    INSERT INTO alerts (
      event_type, severity, message, details, practice_id, created_at
    ) VALUES (
      'document_uploaded',
      'low',
      'New document uploaded',
      jsonb_build_object(
        'document_id', NEW.id,
        'patient_id', NEW.patient_id,
        'document_type', NEW.document_type,
        'uploaded_by', NEW.uploaded_by
      ),
      practice_id_var,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_subscription_alert
CREATE OR REPLACE FUNCTION notify_subscription_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO alerts (
      event_type, severity, message, details, practice_id, created_at
    ) VALUES (
      'subscription_status_change',
      'medium',
      'Subscription status changed to ' || NEW.status,
      jsonb_build_object(
        'subscription_id', NEW.id,
        'practice_id', NEW.practice_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      NEW.practice_id,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_order_status_alert
CREATE OR REPLACE FUNCTION notify_order_status_alert()
RETURNS TRIGGER AS $$
DECLARE
  event_name TEXT;
  alert_message TEXT;
  practice_id_var UUID;
BEGIN
  -- Get practice_id from the order
  SELECT o.practice_id INTO practice_id_var
  FROM orders o
  WHERE o.id = NEW.order_id;

  -- Only trigger on status changes to delivered or completed
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND practice_id_var IS NOT NULL THEN
    IF NEW.status = 'delivered' THEN
      event_name := 'order_delivered';
      alert_message := 'Order has been delivered';
    ELSIF NEW.status = 'completed' THEN
      event_name := 'order_completed';
      alert_message := 'Order has been completed';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO alerts (
      event_type, severity, message, details, practice_id, created_at
    ) VALUES (
      event_name,
      'low',
      alert_message,
      jsonb_build_object(
        'order_line_id', NEW.id,
        'order_id', NEW.order_id,
        'status', NEW.status
      ),
      practice_id_var,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate all triggers
DROP TRIGGER IF EXISTS appointment_alert_trigger ON patient_appointments;
CREATE TRIGGER appointment_alert_trigger
  AFTER INSERT OR UPDATE ON patient_appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_alert();

DROP TRIGGER IF EXISTS patient_message_alert_trigger ON internal_messages;
CREATE TRIGGER patient_message_alert_trigger
  AFTER INSERT ON internal_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_patient_message_alert();

DROP TRIGGER IF EXISTS document_upload_alert_trigger ON patient_documents;
CREATE TRIGGER document_upload_alert_trigger
  AFTER INSERT ON patient_documents
  FOR EACH ROW
  EXECUTE FUNCTION notify_document_alert();

DROP TRIGGER IF EXISTS subscription_status_alert_trigger ON practice_subscriptions;
CREATE TRIGGER subscription_status_alert_trigger
  AFTER UPDATE ON practice_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_subscription_alert();

DROP TRIGGER IF EXISTS order_status_alert_trigger ON order_lines;
CREATE TRIGGER order_status_alert_trigger
  AFTER UPDATE ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_alert();