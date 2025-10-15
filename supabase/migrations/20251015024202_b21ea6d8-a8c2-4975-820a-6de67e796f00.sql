-- Add refills tracking columns to order_lines
ALTER TABLE order_lines
ADD COLUMN refills_allowed boolean DEFAULT false,
ADD COLUMN refills_total integer DEFAULT 0 CHECK (refills_total >= 0 AND refills_total <= 3),
ADD COLUMN refills_remaining integer DEFAULT 0 CHECK (refills_remaining >= 0 AND refills_remaining <= 3),
ADD COLUMN original_order_line_id uuid REFERENCES order_lines(id),
ADD COLUMN is_refill boolean DEFAULT false,
ADD COLUMN refill_number integer DEFAULT 0 CHECK (refill_number >= 0);

-- Create prescription_refills table to track refill history
CREATE TABLE prescription_refills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_order_line_id uuid NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  new_order_line_id uuid NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  refill_number integer NOT NULL CHECK (refill_number > 0),
  new_prescription_url text,
  new_refills_authorized integer DEFAULT 0 CHECK (new_refills_authorized >= 0 AND new_refills_authorized <= 3),
  refilled_by uuid REFERENCES auth.users(id),
  refilled_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(original_order_line_id, refill_number)
);

-- Enable RLS on prescription_refills
ALTER TABLE prescription_refills ENABLE ROW LEVEL SECURITY;

-- RLS policies for prescription_refills
CREATE POLICY "Admins can view all prescription refills"
ON prescription_refills FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can view their prescription refills"
ON prescription_refills FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM order_lines ol
    JOIN orders o ON ol.order_id = o.id
    WHERE ol.id = prescription_refills.original_order_line_id
    AND o.doctor_id = auth.uid()
  )
);

CREATE POLICY "System can insert prescription refills"
ON prescription_refills FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create function to check refill eligibility
CREATE OR REPLACE FUNCTION check_refill_eligibility(p_order_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_line RECORD;
  v_order_created_at timestamp with time zone;
  v_months_since_order numeric;
  v_result jsonb;
BEGIN
  -- Get order line details
  SELECT 
    ol.*,
    o.created_at as order_created_at,
    o.status as order_status
  INTO v_order_line
  FROM order_lines ol
  JOIN orders o ON ol.order_id = o.id
  WHERE ol.id = p_order_line_id;
  
  -- Check if order line exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Order line not found'
    );
  END IF;
  
  -- Check if refills were authorized
  IF NOT v_order_line.refills_allowed OR v_order_line.refills_total = 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'No refills authorized on original prescription'
    );
  END IF;
  
  -- Check if refills remaining
  IF v_order_line.refills_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'All authorized refills have been used'
    );
  END IF;
  
  -- Check 6-month expiration
  v_months_since_order := EXTRACT(EPOCH FROM (now() - v_order_line.order_created_at)) / (60 * 60 * 24 * 30);
  
  IF v_months_since_order > 6 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Prescription expired (more than 6 months old)'
    );
  END IF;
  
  -- Check order status (must be completed or delivered)
  IF v_order_line.order_status NOT IN ('completed', 'processing') THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Original order must be completed or processing'
    );
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'eligible', true,
    'refills_remaining', v_order_line.refills_remaining,
    'original_prescription_date', v_order_line.order_created_at,
    'months_since_order', ROUND(v_months_since_order, 1)
  );
END;
$$;