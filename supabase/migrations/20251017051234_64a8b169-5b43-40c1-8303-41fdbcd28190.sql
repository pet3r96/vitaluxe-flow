-- Create admin-only function to recompute profits for orders
-- This allows backfilling profits when override prices are updated

CREATE OR REPLACE FUNCTION public.recompute_order_profits(
  p_order_ids uuid[] DEFAULT NULL,
  p_status_filter text[] DEFAULT ARRAY['pending', 'processing']::text[]
)
RETURNS TABLE(
  recomputed_count integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_line RECORD;
  v_recomputed_count INTEGER := 0;
  v_order_ids_to_process uuid[];
BEGIN
  -- SECURITY: Only admins can recompute profits
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Determine which orders to recompute
  IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
    -- Use specific order IDs provided
    v_order_ids_to_process := p_order_ids;
  ELSE
    -- Use status filter to find orders
    SELECT ARRAY_AGG(id) INTO v_order_ids_to_process
    FROM orders
    WHERE status = ANY(p_status_filter);
  END IF;

  -- Exit early if no orders to process
  IF v_order_ids_to_process IS NULL OR array_length(v_order_ids_to_process, 1) = 0 THEN
    RETURN QUERY SELECT 0, 'No orders found matching criteria'::text;
    RETURN;
  END IF;

  -- Delete existing profit records for these orders
  DELETE FROM order_profits
  WHERE order_id = ANY(v_order_ids_to_process);

  -- Recompute by updating each order line (triggers calculate_order_line_profit)
  FOR v_order_line IN
    SELECT id, updated_at
    FROM order_lines
    WHERE order_id = ANY(v_order_ids_to_process)
  LOOP
    -- Touch the updated_at to trigger the profit calculation trigger
    UPDATE order_lines
    SET updated_at = now()
    WHERE id = v_order_line.id;
    
    v_recomputed_count := v_recomputed_count + 1;
  END LOOP;

  RETURN QUERY SELECT 
    v_recomputed_count,
    format('Successfully recomputed profits for %s order lines', v_recomputed_count)::text;
END;
$function$;