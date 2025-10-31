-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop the existing trigger functions that have errors
DROP FUNCTION IF EXISTS notify_appointment_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_patient_message_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_document_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_subscription_alert() CASCADE;
DROP FUNCTION IF EXISTS notify_order_status_alert() CASCADE;

-- Recreate notify_appointment_alert function with proper error handling
CREATE OR REPLACE FUNCTION notify_appointment_alert()
RETURNS TRIGGER AS $$
DECLARE
  event_name TEXT;
  alert_message TEXT;
  request_id BIGINT;
BEGIN
  -- Determine event type and message
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

  -- Send alert via HTTP POST using pg_net
  SELECT INTO request_id net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'event_type', event_name,
      'severity', 'low',
      'message', alert_message,
      'details', jsonb_build_object(
        'appointment_id', COALESCE(NEW.id, OLD.id),
        'patient_id', COALESCE(NEW.patient_id, OLD.patient_id),
        'provider_id', COALESCE(NEW.provider_id, OLD.provider_id),
        'start_time', COALESCE(NEW.start_time, OLD.start_time),
        'status', COALESCE(NEW.status, OLD.status)
      )
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_patient_message_alert function
CREATE OR REPLACE FUNCTION notify_patient_message_alert()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Only trigger for messages from patients
  IF NEW.sender_role = 'patient' THEN
    SELECT INTO request_id net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'event_type', 'patient_message',
        'severity', 'low',
        'message', 'New message received from patient',
        'details', jsonb_build_object(
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'practice_id', NEW.practice_id,
          'subject', NEW.subject
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_document_alert function
CREATE OR REPLACE FUNCTION notify_document_alert()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Only trigger for new uploads
  IF TG_OP = 'INSERT' THEN
    SELECT INTO request_id net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'event_type', 'document_uploaded',
        'severity', 'low',
        'message', 'New document uploaded',
        'details', jsonb_build_object(
          'document_id', NEW.id,
          'patient_id', NEW.patient_id,
          'document_type', NEW.document_type,
          'uploaded_by', NEW.uploaded_by
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_subscription_alert function
CREATE OR REPLACE FUNCTION notify_subscription_alert()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Only trigger on status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    SELECT INTO request_id net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'event_type', 'subscription_status_change',
        'severity', 'medium',
        'message', 'Subscription status changed to ' || NEW.status,
        'details', jsonb_build_object(
          'subscription_id', NEW.id,
          'practice_id', NEW.practice_id,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate notify_order_status_alert function
CREATE OR REPLACE FUNCTION notify_order_status_alert()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
  event_name TEXT;
  alert_message TEXT;
BEGIN
  -- Only trigger on status changes to delivered or completed
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'delivered' THEN
      event_name := 'order_delivered';
      alert_message := 'Order has been delivered';
    ELSIF NEW.status = 'completed' THEN
      event_name := 'order_completed';
      alert_message := 'Order has been completed';
    ELSE
      RETURN NEW;
    END IF;

    SELECT INTO request_id net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'event_type', event_name,
        'severity', 'low',
        'message', alert_message,
        'details', jsonb_build_object(
          'order_line_id', NEW.id,
          'order_id', NEW.order_id,
          'status', NEW.status
        )
      )
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