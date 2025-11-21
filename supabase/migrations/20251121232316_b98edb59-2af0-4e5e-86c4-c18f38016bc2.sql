-- Enable pg_net extension for async HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Replace trigger to call handleNotifications directly (instant SMS)
-- and fix timezone to America/New_York
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
  v_formatted_time TEXT;
  v_request_id BIGINT;
BEGIN
  -- Handle INSERT (new appointment scheduled)
  IF TG_OP = 'INSERT' THEN
    -- Skip notification for instant video sessions
    -- Edge function handles this with "Video Session Ready" notification
    IF NEW.notes = 'Created instantly by provider/staff' THEN
      RETURN NEW;
    END IF;
    
    -- Format time in America/New_York timezone (EST/EDT)
    v_formatted_time := TO_CHAR(
      (NEW.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York',
      'FMMonth DD, YYYY at HH12:MI AM'
    );
    
    v_notification_title := 'Appointment Scheduled';
    v_notification_message := 'Your appointment has been scheduled for ' || v_formatted_time;
    
  -- Handle UPDATE (status changes only)
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only notify on status changes
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
    
    -- Format time in America/New_York timezone (EST/EDT)
    v_formatted_time := TO_CHAR(
      (NEW.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York',
      'FMMonth DD, YYYY at HH12:MI AM'
    );
    
    -- Set notification content based on new status
    CASE NEW.status
      WHEN 'confirmed' THEN
        v_notification_title := 'Appointment Confirmed';
        v_notification_message := 'Your appointment has been confirmed for ' || v_formatted_time;
      WHEN 'cancelled' THEN
        v_notification_title := 'Appointment Cancelled';
        v_notification_message := 'Your appointment scheduled for ' || v_formatted_time || ' has been cancelled';
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
  
  -- Make instant HTTP call to handleNotifications (NO QUEUE DELAY)
  -- Using pg_net for async HTTP request from database
  SELECT net.http_post(
    url := 'https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/handleNotifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidHNmYWpzaG5yd3dsZnprZW9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDExMSwiZXhwIjoyMDc1NTcwMTExfQ.oVwg7qTHIoU4N-KiX-8PcI2gYs_-LyU6zY9i-d7M4zM'
    ),
    body := jsonb_build_object(
      'user_id', v_patient_user_id,
      'notification_type', 'appointment_reminder',
      'title', v_notification_title,
      'message', v_notification_message,
      'metadata', jsonb_build_object(
        'appointment_id', NEW.id,
        'status', NEW.status,
        'appointment_time', NEW.start_time,
        'service_type', NEW.service_type
      ),
      'action_url', '/patient/appointments',
      'entity_type', 'appointment',
      'entity_id', NEW.id::TEXT
    )
  ) INTO v_request_id;
  
  RETURN NEW;
END;
$$;