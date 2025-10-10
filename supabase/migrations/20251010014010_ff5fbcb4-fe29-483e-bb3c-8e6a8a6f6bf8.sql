-- Fix the trigger function to properly handle enum status values
CREATE OR REPLACE FUNCTION public.update_order_status_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Status 'filled' means the line entered fulfillment/processing
  IF NEW.status::text = 'filled' AND OLD.status::text <> 'filled' THEN
    NEW.processing_at = now();
  END IF;

  -- Status 'shipped' sets shipped_at
  IF NEW.status::text = 'shipped' AND OLD.status::text <> 'shipped' THEN
    NEW.shipped_at = now();
  END IF;

  -- Safe check for delivered (no error if not in enum)
  IF NEW.status::text = 'delivered' AND OLD.status::text <> 'delivered' THEN
    NEW.delivered_at = now();
  END IF;

  RETURN NEW;
END;
$$;