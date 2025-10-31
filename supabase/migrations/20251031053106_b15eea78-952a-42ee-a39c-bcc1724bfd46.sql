-- Add operational alerts for practice management
-- This migration creates triggers to automatically generate alerts for key operational events

-- 1. APPOINTMENT ALERTS (new, modified, canceled)
CREATE OR REPLACE FUNCTION public.notify_appointment_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  event_name text;
  alert_message text;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_name := 'appointment_new';
    alert_message := 'New appointment created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'cancelled' THEN
    event_name := 'appointment_canceled';
    alert_message := 'Appointment canceled';
  ELSIF TG_OP = 'UPDATE' THEN
    event_name := 'appointment_modified';
    alert_message := 'Appointment modified';
  ELSE
    RETURN NEW;
  END IF;

  -- Call trigger-alert edge function
  PERFORM
    net.http_post(
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER appointment_alert_trigger
AFTER INSERT OR UPDATE ON public.patient_appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_alert();

-- 2. PATIENT MESSAGE ALERTS (messages from patients to practice)
CREATE OR REPLACE FUNCTION public.notify_patient_message_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only alert on messages FROM patient accounts (check if sender is in patient_accounts)
  IF EXISTS (SELECT 1 FROM public.patient_accounts WHERE id = NEW.sender_id) THEN
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'event_type', 'patient_message',
          'severity', 'low',
          'message', 'New message from patient',
          'details', jsonb_build_object(
            'message_id', NEW.id,
            'patient_id', NEW.sender_id,
            'thread_id', NEW.thread_id,
            'subject', NEW.subject
          )
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER patient_message_alert_trigger
AFTER INSERT ON public.internal_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_patient_message_alert();

-- 3. DOCUMENT UPLOAD ALERTS
CREATE OR REPLACE FUNCTION public.notify_document_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM
    net.http_post(
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
          'document_name', NEW.document_name,
          'uploaded_at', NEW.uploaded_at
        )
      )
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER document_upload_alert_trigger
AFTER INSERT ON public.patient_documents
FOR EACH ROW EXECUTE FUNCTION public.notify_document_alert();

-- 4. SUBSCRIPTION STATUS ALERTS
CREATE OR REPLACE FUNCTION public.notify_subscription_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only alert on status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'event_type', 'subscription_status_change',
          'severity', CASE 
            WHEN NEW.status IN ('cancelled', 'past_due') THEN 'high'
            ELSE 'medium'
          END,
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
$$;

CREATE TRIGGER subscription_status_alert_trigger
AFTER UPDATE ON public.practice_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_alert();

-- 5. ORDER DELIVERY/COMPLETION ALERTS
CREATE OR REPLACE FUNCTION public.notify_order_status_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only alert when status changes to delivered or completed
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('delivered', 'completed') THEN
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/trigger-alert',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'event_type', CASE 
            WHEN NEW.status = 'delivered' THEN 'order_delivered'
            ELSE 'order_completed'
          END,
          'severity', 'low',
          'message', 'Order ' || NEW.status,
          'details', jsonb_build_object(
            'order_line_id', NEW.id,
            'order_id', NEW.order_id,
            'patient_name', NEW.patient_name,
            'tracking_number', NEW.tracking_number
          )
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER order_status_alert_trigger
AFTER UPDATE ON public.order_lines
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_alert();