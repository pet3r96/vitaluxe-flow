
-- Create function to automatically populate order_profits
-- This runs without needing authentication
CREATE OR REPLACE FUNCTION auto_populate_order_profits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_topline_user_id UUID;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_topline_profit DECIMAL(10,2);
  v_downline_profit DECIMAL(10,2);
  v_order_line RECORD;
BEGIN
  -- Clear existing profits
  DELETE FROM order_profits;

  -- Loop through all paid orders
  FOR v_order IN 
    SELECT 
      o.id,
      o.total_amount,
      o.payment_status,
      o.practice_id
    FROM orders o
    WHERE o.payment_status = 'paid'
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered', 'completed')
  LOOP
    -- Get topline user from practice linkage
    SELECT linked_topline_id INTO v_topline_user_id
    FROM profiles
    WHERE id = v_order.practice_id;

    IF v_topline_user_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Get topline rep
    SELECT id INTO v_topline_rep_id
    FROM reps
    WHERE user_id = v_topline_user_id
      AND role = 'topline'
    LIMIT 1;

    IF v_topline_rep_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Get downline rep if exists
    SELECT id INTO v_downline_rep_id
    FROM reps
    WHERE assigned_topline_id = v_topline_rep_id
      AND role = 'downline'
    LIMIT 1;

    -- Calculate profits from order lines (non-RX products only)
    v_topline_profit := 0;
    v_downline_profit := 0;

    FOR v_order_line IN
      SELECT 
        ol.quantity,
        p.base_price,
        p.topline_price,
        p.downline_price,
        p.requires_prescription
      FROM order_lines ol
      JOIN products p ON p.id = ol.product_id
      WHERE ol.order_id = v_order.id
    LOOP
      IF NOT v_order_line.requires_prescription THEN
        -- Topline profit
        IF v_order_line.topline_price IS NOT NULL AND v_order_line.base_price IS NOT NULL THEN
          v_topline_profit := v_topline_profit + 
            ((v_order_line.topline_price - v_order_line.base_price) * COALESCE(v_order_line.quantity, 1));
        END IF;

        -- Downline profit (only if downline exists)
        IF v_downline_rep_id IS NOT NULL AND 
           v_order_line.downline_price IS NOT NULL AND 
           v_order_line.base_price IS NOT NULL THEN
          v_downline_profit := v_downline_profit + 
            ((v_order_line.downline_price - v_order_line.base_price) * COALESCE(v_order_line.quantity, 1));
        END IF;
      END IF;
    END LOOP;

    -- Insert profit record
    INSERT INTO order_profits (
      order_id,
      order_total,
      topline_id,
      topline_profit,
      downline_id,
      downline_profit,
      payment_status
    ) VALUES (
      v_order.id,
      v_order.total_amount,
      v_topline_rep_id,
      v_topline_profit,
      v_downline_rep_id,
      v_downline_profit,
      v_order.payment_status
    );
  END LOOP;

  -- Refresh rep productivity view
  REFRESH MATERIALIZED VIEW CONCURRENTLY rep_productivity_view;
END;
$$;

-- Execute the function immediately to populate data
SELECT auto_populate_order_profits();
