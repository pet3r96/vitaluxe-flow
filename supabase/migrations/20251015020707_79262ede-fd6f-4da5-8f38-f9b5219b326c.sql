-- Create notification_type enum
CREATE TYPE notification_type AS ENUM (
  'message',
  'order_status',
  'order_shipped',
  'order_delivered',
  'order_issue',
  'account_alert',
  'system_announcement',
  'payment_method',
  'practice_approved',
  'rep_approved',
  'low_inventory'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type notification_type NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'success')),
  
  -- Linked entities
  entity_type TEXT,
  entity_id UUID,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Status tracking
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(notification_type);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notifications"
ON public.notifications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RPC function to get unread count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.notifications
    WHERE user_id = auth.uid() AND read = FALSE
  );
END;
$$;

-- Create RPC function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

-- Create RPC function to mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND read = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create trigger function for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_participants UUID[];
  participant_id UUID;
  thread_subject TEXT;
  thread_type_val TEXT;
  sender_name TEXT;
BEGIN
  -- Get thread details
  SELECT subject, thread_type INTO thread_subject, thread_type_val
  FROM public.message_threads
  WHERE id = NEW.thread_id;
  
  -- Get sender name
  SELECT name INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Get all participants except the sender
  SELECT ARRAY_AGG(tp.user_id) INTO thread_participants
  FROM public.thread_participants tp
  WHERE tp.thread_id = NEW.thread_id
    AND tp.user_id != NEW.sender_id;
  
  -- Create notification for each participant
  IF thread_participants IS NOT NULL THEN
    FOREACH participant_id IN ARRAY thread_participants
    LOOP
      INSERT INTO public.notifications (
        user_id,
        notification_type,
        severity,
        title,
        message,
        entity_type,
        entity_id,
        action_url,
        metadata
      ) VALUES (
        participant_id,
        CASE 
          WHEN thread_type_val = 'order_issue' THEN 'order_issue'::notification_type
          ELSE 'message'::notification_type
        END,
        'info',
        'New Message: ' || thread_subject,
        COALESCE(sender_name, 'Someone') || ' sent a message: ' || 
        LEFT(NEW.body, 100) || CASE WHEN LENGTH(NEW.body) > 100 THEN '...' ELSE '' END,
        'message_thread',
        NEW.thread_id,
        '/messages',
        jsonb_build_object(
          'sender_id', NEW.sender_id,
          'thread_type', thread_type_val,
          'thread_id', NEW.thread_id
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- Create trigger function for order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  practice_user_id UUID;
  notification_type_val notification_type;
  notification_title TEXT;
  notification_severity TEXT;
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Get the practice user_id
    SELECT doctor_id INTO practice_user_id
    FROM public.orders
    WHERE id = NEW.order_id;
    
    -- Determine notification details
    notification_severity := 'info';
    
    CASE NEW.status::text
      WHEN 'shipped' THEN
        notification_type_val := 'order_shipped'::notification_type;
        notification_title := 'Order Shipped';
        notification_severity := 'success';
      WHEN 'delivered' THEN
        notification_type_val := 'order_delivered'::notification_type;
        notification_title := 'Order Delivered';
        notification_severity := 'success';
      WHEN 'cancelled' THEN
        notification_title := 'Order Cancelled';
        notification_severity := 'warning';
        notification_type_val := 'order_status'::notification_type;
      WHEN 'denied' THEN
        notification_title := 'Order Line Denied';
        notification_severity := 'error';
        notification_type_val := 'order_status'::notification_type;
      ELSE
        notification_type_val := 'order_status'::notification_type;
        notification_title := 'Order Status Updated';
    END CASE;
    
    -- Create notification
    INSERT INTO public.notifications (
      user_id,
      notification_type,
      severity,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      practice_user_id,
      notification_type_val,
      notification_severity,
      notification_title,
      'Order line status changed to: ' || NEW.status::text || 
      CASE WHEN NEW.tracking_number IS NOT NULL 
        THEN ' (Tracking: ' || NEW.tracking_number || ')' 
        ELSE '' 
      END,
      'order_line',
      NEW.id,
      '/orders',
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_line_id', NEW.id,
        'old_status', OLD.status::text,
        'new_status', NEW.status::text,
        'tracking_number', NEW.tracking_number
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_order_status
AFTER UPDATE ON public.order_lines
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();