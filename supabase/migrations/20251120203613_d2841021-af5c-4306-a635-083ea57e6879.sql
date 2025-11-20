-- =====================================================
-- PHASE 1: Create notification_queue table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  action_url TEXT,
  entity_type TEXT,
  entity_id TEXT,
  
  -- Queue management
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'sent', 'failed'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON public.notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending ON public.notification_queue(created_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only for now)
CREATE POLICY "Admins can view all queue items"
  ON public.notification_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- =====================================================
-- PHASE 2: Update all 7 trigger functions to use queue
-- =====================================================

-- 1. Update notify_new_message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_user_id UUID;
  sender_name TEXT;
BEGIN
  -- Get sender name
  SELECT COALESCE(name, 'Someone') INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;
  
  -- Queue notification for each participant
  FOR participant_user_id IN
    SELECT tp.user_id 
    FROM thread_participants tp
    WHERE tp.thread_id = NEW.thread_id
    AND tp.user_id != NEW.sender_id
  LOOP
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
      participant_user_id,
      'message_received',
      'New Message',
      sender_name || ': ' || LEFT(NEW.body, 100),
      jsonb_build_object(
        'thread_id', NEW.thread_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'sender_name', sender_name
      ),
      '/messages',
      'message',
      NEW.id::TEXT
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 2. Update notify_patient_of_practice_message
CREATE OR REPLACE FUNCTION public.notify_patient_of_practice_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id UUID;
  v_practice_name TEXT;
BEGIN
  -- Only notify for new root messages from practice to patient
  IF NEW.parent_message_id IS NOT NULL THEN
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
  
  -- Get practice name
  SELECT p.name INTO v_practice_name
  FROM profiles p
  WHERE p.id = NEW.practice_id;
  
  -- Queue notification
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
    'message_received',
    'New Message from ' || COALESCE(v_practice_name, 'Your Practice'),
    LEFT(NEW.content, 150),
    jsonb_build_object(
      'message_id', NEW.id,
      'practice_id', NEW.practice_id,
      'patient_id', NEW.patient_id
    ),
    '/patient/messages',
    'patient_message',
    NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$;

-- 3. Update notify_order_status_change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_id UUID;
  v_order_number TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only notify on status changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  
  -- Get doctor_id and order_number
  SELECT doctor_id, order_number INTO v_doctor_id, v_order_number
  FROM orders
  WHERE id = NEW.order_id;
  
  -- Set notification content based on status
  CASE NEW.status
    WHEN 'shipped' THEN
      v_notification_title := 'Order Shipped';
      v_notification_message := 'Order #' || v_order_number || ' has been shipped';
    WHEN 'delivered' THEN
      v_notification_title := 'Order Delivered';
      v_notification_message := 'Order #' || v_order_number || ' has been delivered';
    ELSE
      RETURN NEW; -- Don't notify for other statuses
  END CASE;
  
  -- Queue notification
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
    v_doctor_id,
    'order_status',
    v_notification_title,
    v_notification_message,
    jsonb_build_object(
      'order_id', NEW.order_id,
      'order_line_id', NEW.id,
      'order_number', v_order_number,
      'status', NEW.status,
      'tracking_number', NEW.tracking_number
    ),
    '/orders',
    'order_line',
    NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$;

-- 4. Update notify_follow_up_assignment
CREATE OR REPLACE FUNCTION public.notify_follow_up_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_user_id UUID;
  v_patient_name TEXT;
BEGIN
  -- Only notify on new assignments
  IF NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF OLD.assigned_to_user_id IS NOT DISTINCT FROM NEW.assigned_to_user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get patient name
  SELECT COALESCE(first_name || ' ' || last_name, 'Patient') INTO v_patient_name
  FROM patient_accounts
  WHERE id = NEW.patient_id;
  
  -- Queue notification
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
    NEW.assigned_to_user_id,
    'follow_up_due',
    'Follow-Up Assigned',
    'You have been assigned a follow-up for ' || v_patient_name,
    jsonb_build_object(
      'follow_up_id', NEW.id,
      'patient_id', NEW.patient_id,
      'patient_name', v_patient_name,
      'due_date', NEW.follow_up_date
    ),
    '/patients',
    'follow_up',
    NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$;

-- 5. Update notify_internal_message
CREATE OR REPLACE FUNCTION public.notify_internal_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
BEGIN
  -- Get sender name
  SELECT COALESCE(name, 'Someone') INTO v_sender_name
  FROM profiles
  WHERE id = NEW.created_by;
  
  -- Queue notification for each recipient
  FOR v_recipient_id IN
    SELECT recipient_id
    FROM internal_message_recipients
    WHERE message_id = NEW.id
  LOOP
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
      v_recipient_id,
      'message_received',
      'New Internal Message',
      v_sender_name || ': ' || NEW.subject,
      jsonb_build_object(
        'message_id', NEW.id,
        'sender_id', NEW.created_by,
        'sender_name', v_sender_name,
        'priority', NEW.priority
      ),
      '/internal-messages',
      'internal_message',
      NEW.id::TEXT
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 6. Update notify_internal_message_reply (create if doesn't exist)
CREATE OR REPLACE FUNCTION public.notify_internal_message_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_sender UUID;
  v_replier_name TEXT;
  v_message_subject TEXT;
BEGIN
  -- Get original message creator
  SELECT created_by, subject INTO v_original_sender, v_message_subject
  FROM internal_messages
  WHERE id = NEW.message_id;
  
  -- Don't notify if replying to own message
  IF v_original_sender = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Get replier name
  SELECT COALESCE(name, 'Someone') INTO v_replier_name
  FROM profiles
  WHERE id = auth.uid();
  
  -- Queue notification
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
    v_original_sender,
    'message_received',
    'Reply to: ' || v_message_subject,
    v_replier_name || ' replied to your message',
    jsonb_build_object(
      'message_id', NEW.message_id,
      'reply_id', NEW.id,
      'replier_id', auth.uid(),
      'replier_name', v_replier_name
    ),
    '/internal-messages',
    'internal_message',
    NEW.message_id::TEXT
  );
  
  RETURN NEW;
END;
$$;

-- 7. Update notify_patient_of_appointment_update
CREATE OR REPLACE FUNCTION public.notify_patient_of_appointment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only notify on status changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
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
  
  -- Set notification content based on status
  CASE NEW.status
    WHEN 'confirmed' THEN
      v_notification_title := 'Appointment Confirmed';
      v_notification_message := 'Your appointment has been confirmed';
    WHEN 'cancelled' THEN
      v_notification_title := 'Appointment Cancelled';
      v_notification_message := 'Your appointment has been cancelled';
    WHEN 'completed' THEN
      v_notification_title := 'Appointment Completed';
      v_notification_message := 'Your appointment has been completed';
    ELSE
      RETURN NEW; -- Don't notify for other statuses
  END CASE;
  
  -- Queue notification
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
      'appointment_time', NEW.start_time
    ),
    '/patient/appointments',
    'appointment',
    NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$;