-- ============================================
-- Fix recompute_order_profits function
-- ============================================

DROP FUNCTION IF EXISTS recompute_order_profits(text[]);

CREATE OR REPLACE FUNCTION recompute_order_profits(p_status_filter text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_order RECORD;
  v_topline_rep_id uuid;
  v_downline_rep_id uuid;
  v_total_topline_profit DECIMAL(10,2);
  v_total_downline_profit DECIMAL(10,2);
  v_order_total DECIMAL(10,2);
BEGIN
  -- Loop through orders with specified statuses (default to paid orders)
  FOR v_order IN 
    SELECT 
      o.id as order_id,
      o.doctor_id,
      o.total_amount,
      o.payment_status,
      p.linked_topline_id as practice_topline_user_id
    FROM orders o
    INNER JOIN profiles p ON p.id = o.doctor_id
    WHERE o.payment_status = 'paid'
      AND (p_status_filter IS NULL OR o.status = ANY(p_status_filter))
  LOOP
    BEGIN
      -- Reset profit totals for this order
      v_total_topline_profit := 0;
      v_total_downline_profit := 0;
      v_topline_rep_id := NULL;
      v_downline_rep_id := NULL;
      
      -- Get the topline rep ID from the practice's linked_topline_id
      SELECT r.id INTO v_topline_rep_id
      FROM reps r
      WHERE r.user_id = v_order.practice_topline_user_id
        AND r.role = 'topline'
      LIMIT 1;
      
      -- Get downline rep if exists (downline assigned to this topline)
      IF v_topline_rep_id IS NOT NULL THEN
        SELECT r.id INTO v_downline_rep_id
        FROM reps r
        WHERE r.assigned_topline_id = v_topline_rep_id
          AND r.role = 'downline'
        LIMIT 1;
      END IF;
      
      -- Calculate profits from order lines (only non-RX products)
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN prod.requires_prescription = FALSE AND prod.topline_price IS NOT NULL
            THEN (prod.topline_price - prod.base_price) * ol.quantity
            ELSE 0
          END
        ), 0) as topline_profit,
        COALESCE(SUM(
          CASE 
            WHEN prod.requires_prescription = FALSE AND prod.downline_price IS NOT NULL AND v_downline_rep_id IS NOT NULL
            THEN (prod.downline_price - prod.base_price) * ol.quantity
            ELSE 0
          END
        ), 0) as downline_profit
      INTO v_total_topline_profit, v_total_downline_profit
      FROM order_lines ol
      INNER JOIN products prod ON prod.id = ol.product_id
      WHERE ol.order_id = v_order.order_id;
      
      -- Upsert profit record
      INSERT INTO order_profits (
        order_id,
        order_total,
        topline_id,
        topline_profit,
        downline_id,
        downline_profit,
        payment_status
      ) VALUES (
        v_order.order_id,
        v_order.total_amount,
        v_topline_rep_id,
        v_total_topline_profit,
        v_downline_rep_id,
        v_total_downline_profit,
        v_order.payment_status
      )
      ON CONFLICT (order_id) DO UPDATE SET
        order_total = EXCLUDED.order_total,
        topline_id = EXCLUDED.topline_id,
        topline_profit = EXCLUDED.topline_profit,
        downline_id = EXCLUDED.downline_id,
        downline_profit = EXCLUDED.downline_profit,
        payment_status = EXCLUDED.payment_status,
        updated_at = now();
      
      v_processed_count := v_processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE WARNING 'Error processing order %: %', v_order.order_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', v_processed_count,
    'errors', v_error_count,
    'success', true
  );
END;
$$;

-- ============================================
-- Add assigned_rep_id to practice_subscriptions
-- ============================================

ALTER TABLE practice_subscriptions 
ADD COLUMN IF NOT EXISTS assigned_rep_id uuid REFERENCES reps(id);

CREATE INDEX IF NOT EXISTS idx_practice_subscriptions_assigned_rep 
ON practice_subscriptions(assigned_rep_id);

-- Backfill existing subscriptions with their practice's topline rep
UPDATE practice_subscriptions ps
SET assigned_rep_id = r.id
FROM profiles p
JOIN reps r ON r.user_id = p.linked_topline_id
WHERE ps.practice_id = p.id
  AND r.role = 'topline'
  AND ps.assigned_rep_id IS NULL;