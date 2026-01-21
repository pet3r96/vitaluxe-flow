-- Fix notify_order_status_change trigger function that references non-existent order_number column
-- The orders table doesn't have order_number, use id instead

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_doctor_id UUID;
  v_order_display TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only notify on status changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  
  -- Get doctor_id and use order id for display (first 8 chars)
  SELECT doctor_id INTO v_doctor_id
  FROM orders
  WHERE id = NEW.order_id;
  
  -- Use order_id first 8 characters as display reference
  v_order_display := LEFT(NEW.order_id::TEXT, 8);
  
  -- Set notification content based on status
  CASE NEW.status
    WHEN 'shipped' THEN
      v_notification_title := 'Order Shipped';
      v_notification_message := 'Order #' || v_order_display || ' has been shipped';
    WHEN 'delivered' THEN
      v_notification_title := 'Order Delivered';
      v_notification_message := 'Order #' || v_order_display || ' has been delivered';
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
      'order_display', v_order_display,
      'status', NEW.status,
      'tracking_number', NEW.tracking_number
    ),
    '/orders',
    'order_line',
    NEW.id::TEXT
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;