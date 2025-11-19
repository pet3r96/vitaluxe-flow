-- Make topline_id nullable to allow orders without topline reps
ALTER TABLE order_profits
ALTER COLUMN topline_id DROP NOT NULL;

-- Update auto_populate_order_profits function to skip orders without topline
CREATE OR REPLACE FUNCTION auto_populate_order_profits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_topline_profit NUMERIC := 0;
  v_downline_profit NUMERIC := 0;
  v_admin_profit NUMERIC := 0;
BEGIN
  -- Clear existing data
  DELETE FROM order_profits;
  
  -- Loop through all paid orders
  FOR v_order IN 
    SELECT o.id, o.total_amount, o.payment_status, o.doctor_id,
           p.linked_topline_id
    FROM orders o
    JOIN profiles p ON p.id = o.doctor_id
    WHERE o.payment_status = 'paid'
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered', 'completed')
  LOOP
    -- Get topline rep
    v_topline_rep_id := NULL;
    IF v_order.linked_topline_id IS NOT NULL THEN
      SELECT id INTO v_topline_rep_id
      FROM reps
      WHERE user_id = v_order.linked_topline_id
        AND role = 'topline'
      LIMIT 1;
    END IF;
    
    -- Skip orders without a topline rep (no commissions to calculate)
    IF v_topline_rep_id IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Get downline rep if exists
    v_downline_rep_id := NULL;
    SELECT id INTO v_downline_rep_id
    FROM reps
    WHERE assigned_topline_id = v_topline_rep_id
      AND role = 'downline'
    LIMIT 1;
    
    -- Calculate profits from non-RX products
    v_topline_profit := 0;
    v_downline_profit := 0;
    
    SELECT 
      COALESCE(SUM(
        CASE WHEN pr.requires_prescription = false AND pr.topline_price IS NOT NULL
        THEN (pr.topline_price - pr.base_price) * COALESCE(ol.quantity, 1)
        ELSE 0 END
      ), 0),
      COALESCE(SUM(
        CASE WHEN pr.requires_prescription = false AND pr.downline_price IS NOT NULL AND v_downline_rep_id IS NOT NULL
        THEN (pr.downline_price - pr.base_price) * COALESCE(ol.quantity, 1)
        ELSE 0 END
      ), 0)
    INTO v_topline_profit, v_downline_profit
    FROM order_lines ol
    JOIN products pr ON pr.id = ol.product_id
    WHERE ol.order_id = v_order.id;
    
    -- Calculate admin profit
    v_admin_profit := v_order.total_amount - v_topline_profit - v_downline_profit;
    
    -- Insert profit record
    INSERT INTO order_profits (
      order_id, order_total, 
      topline_id, topline_profit,
      downline_id, downline_profit,
      admin_profit,
      payment_status
    ) VALUES (
      v_order.id, v_order.total_amount,
      v_topline_rep_id, v_topline_profit,
      v_downline_rep_id, v_downline_profit,
      v_admin_profit,
      v_order.payment_status
    );
  END LOOP;
  
  -- Refresh rep productivity view
  PERFORM refresh_rep_productivity_summary();
END;
$$;

-- Execute the function immediately
SELECT auto_populate_order_profits();