-- Fix trigger functions to match alerts table schema
DROP FUNCTION IF EXISTS notify_appointment_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_patient_message_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_document_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_subscription_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_order_status_alert() CASCADE;

CREATE OR REPLACE FUNCTION notify_appointment_alert()
RETURNS TRIGGER AS $$
DECLARE
  event_name TEXT;
  alert_message TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_name := 'appointment_new';
    alert_message := 'New appointment created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status AND NEW.status = 'cancelled' THEN
      event_name := 'appointment_canceled';
      alert_message := 'Appointment was cancelled';
    ELSIF OLD.start_time != NEW.start_time OR OLD.end_time != NEW.end_time THEN
      event_name := 'appointment_modified';
      alert_message := 'Appointment time was modified';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN OLD;
  END IF;

  INSERT INTO alerts (event_type, severity, message, details, triggered_at)
  VALUES (event_name, 'low', alert_message, 
    jsonb_build_object('appointment_id', COALESCE(NEW.id, OLD.id), 'patient_id', COALESCE(NEW.patient_id, OLD.patient_id)), 
    NOW());

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER appointment_alert_trigger AFTER INSERT OR UPDATE ON patient_appointments
FOR EACH ROW EXECUTE FUNCTION notify_appointment_alert();