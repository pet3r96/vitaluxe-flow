-- Track ALL orders in order_profits, including unassigned practices
CREATE OR REPLACE FUNCTION auto_populate_order_profits()
RETURNS void AS $$
DECLARE
  v_order RECORD;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_topline_profit NUMERIC := 0;
  v_downline_profit NUMERIC := 0;
  v_admin_profit NUMERIC := 0;
BEGIN
  DELETE FROM order_profits;
  
  -- Process ALL paid orders, regardless of rep assignment
  FOR v_order IN 
    SELECT o.id, o.total_amount, o.payment_status, o.doctor_id,
           p.linked_topline_id
    FROM orders o
    JOIN profiles p ON p.id = o.doctor_id
    WHERE o.payment_status = 'paid'
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered', 'completed')
  LOOP
    -- Reset variables for each order
    v_topline_rep_id := NULL;
    v_downline_rep_id := NULL;
    v_topline_profit := 0;
    v_downline_profit := 0;
    v_admin_profit := 0;
    
    -- Only lookup reps if practice has topline assigned
    IF v_order.linked_topline_id IS NOT NULL THEN
      SELECT id INTO v_topline_rep_id
      FROM reps
      WHERE user_id = v_order.linked_topline_id
        AND role = 'topline'
      LIMIT 1;
      
      -- Only calculate rep commissions if topline rep exists
      IF v_topline_rep_id IS NOT NULL THEN
        SELECT id INTO v_downline_rep_id
        FROM reps
        WHERE assigned_topline_id = v_topline_rep_id
          AND role = 'downline'
        LIMIT 1;
        
        -- Calculate topline and downline profits
        SELECT 
          COALESCE(SUM(
            CASE WHEN pr.requires_prescription = false AND pr.topline_price IS NOT NULL
            THEN (pr.topline_price - pr.base_price) * ol.quantity
            ELSE 0 END
          ), 0),
          COALESCE(SUM(
            CASE WHEN pr.requires_prescription = false AND pr.downline_price IS NOT NULL AND v_downline_rep_id IS NOT NULL
            THEN (pr.downline_price - pr.base_price) * ol.quantity
            ELSE 0 END
          ), 0)
        INTO v_topline_profit, v_downline_profit
        FROM order_lines ol
        JOIN products pr ON pr.id = ol.product_id
        WHERE ol.order_id = v_order.id;
        
        v_admin_profit := v_order.total_amount - v_topline_profit - v_downline_profit;
      ELSE
        -- No topline rep found, 100% to admin
        v_admin_profit := v_order.total_amount;
      END IF;
    ELSE
      -- No topline assigned to practice, 100% to admin
      v_admin_profit := v_order.total_amount;
    END IF;
    
    -- Insert record for ALL orders (assigned and unassigned)
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
      'pending'
    );
  END LOOP;
  
  REFRESH MATERIALIZED VIEW CONCURRENTLY rep_productivity_view;
END;
$$ LANGUAGE plpgsql;

-- Execute to populate with all orders
SELECT auto_populate_order_profits();