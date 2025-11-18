-- Drop existing function and recreate with correct return type
DROP FUNCTION IF EXISTS public.recompute_order_profits(uuid[], text[]);

-- Create function to recompute order profits
CREATE OR REPLACE FUNCTION public.recompute_order_profits(
  p_order_ids uuid[] DEFAULT NULL,
  p_status_filter text[] DEFAULT ARRAY['pending', 'processing', 'shipped', 'delivered', 'completed']
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_processed_count INTEGER := 0;
  v_order RECORD;
  v_topline_id uuid;
  v_downline_id uuid;
  v_topline_profit NUMERIC := 0;
  v_downline_profit NUMERIC := 0;
BEGIN
  -- Loop through orders matching criteria
  FOR v_order IN
    SELECT 
      o.id as order_id,
      o.total_amount,
      o.payment_status,
      o.status,
      p.linked_topline_id,
      p.linked_downline_id
    FROM orders o
    LEFT JOIN profiles p ON p.id = o.doctor_id
    WHERE 
      (p_order_ids IS NULL OR o.id = ANY(p_order_ids))
      AND (p_status_filter IS NULL OR o.status = ANY(p_status_filter))
      AND o.total_amount > 0
  LOOP
    -- Get topline rep_id from user_id
    SELECT id INTO v_topline_id
    FROM reps
    WHERE user_id = v_order.linked_topline_id
      AND role = 'topline'
    LIMIT 1;
    
    -- Get downline rep_id from user_id if exists
    IF v_order.linked_downline_id IS NOT NULL THEN
      SELECT id INTO v_downline_id
      FROM reps
      WHERE user_id = v_order.linked_downline_id
        AND role = 'downline'
      LIMIT 1;
    ELSE
      v_downline_id := NULL;
    END IF;
    
    -- Skip if no topline found
    CONTINUE WHEN v_topline_id IS NULL;
    
    -- Calculate profits (example: 10% for topline, 5% for downline)
    v_topline_profit := v_order.total_amount * 0.10;
    v_downline_profit := CASE 
      WHEN v_downline_id IS NOT NULL THEN v_order.total_amount * 0.05
      ELSE 0
    END;
    
    -- Upsert into order_profits
    INSERT INTO order_profits (
      order_id,
      topline_id,
      downline_id,
      order_total,
      topline_profit,
      downline_profit,
      payment_status,
      created_at,
      updated_at
    ) VALUES (
      v_order.order_id,
      v_topline_id,
      v_downline_id,
      v_order.total_amount,
      v_topline_profit,
      v_downline_profit,
      v_order.payment_status,
      now(),
      now()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      topline_id = EXCLUDED.topline_id,
      downline_id = EXCLUDED.downline_id,
      order_total = EXCLUDED.order_total,
      topline_profit = EXCLUDED.topline_profit,
      downline_profit = EXCLUDED.downline_profit,
      payment_status = EXCLUDED.payment_status,
      updated_at = now();
    
    v_processed_count := v_processed_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'message', format('Recomputed profits for %s orders', v_processed_count)
  );
END;
$function$;