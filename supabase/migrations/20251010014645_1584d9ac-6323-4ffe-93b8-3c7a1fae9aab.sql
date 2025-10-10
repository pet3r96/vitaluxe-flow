-- Add cancellation tracking columns to orders table
ALTER TABLE public.orders
  ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN cancellation_reason TEXT;

-- Create function to validate cancellation eligibility
CREATE OR REPLACE FUNCTION public.can_cancel_order(
  _order_id UUID,
  _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
  is_admin BOOLEAN;
  within_hour BOOLEAN;
BEGIN
  -- Get order details
  SELECT doctor_id, created_at, status
  INTO order_record
  FROM orders
  WHERE id = _order_id;
  
  -- Return false if order not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is admin
  is_admin := has_role(_user_id, 'admin'::app_role);
  
  -- Check if within 1 hour
  within_hour := (EXTRACT(EPOCH FROM (NOW() - order_record.created_at)) / 3600) < 1;
  
  -- Cannot cancel already cancelled orders
  IF order_record.status = 'cancelled' THEN
    RETURN FALSE;
  END IF;
  
  -- Admin can cancel anytime
  IF is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Doctor can cancel their own within 1 hour
  IF order_record.doctor_id = _user_id AND within_hour THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Add RLS policy for order cancellation
CREATE POLICY "Users can cancel eligible orders"
ON public.orders
FOR UPDATE
USING (
  public.can_cancel_order(id, auth.uid())
)
WITH CHECK (
  public.can_cancel_order(id, auth.uid())
);

-- Create trigger function to unassign order lines on cancellation
CREATE OR REPLACE FUNCTION public.handle_order_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When order is cancelled, unassign all order lines from pharmacies
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE order_lines
    SET assigned_pharmacy_id = NULL,
        status = 'denied'::order_status
    WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
CREATE TRIGGER on_order_cancelled
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'cancelled'))
  EXECUTE FUNCTION public.handle_order_cancellation();