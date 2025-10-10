-- Fix security warning by setting search_path on the function
CREATE OR REPLACE FUNCTION update_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Aggregate statuses from all order lines for this order
  WITH line_statuses AS (
    SELECT 
      order_id,
      COUNT(*) as total_lines,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
      COUNT(*) FILTER (WHERE status = 'shipped') as shipped_count,
      COUNT(*) FILTER (WHERE status = 'denied') as denied_count,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE status = 'filled') as filled_count
    FROM order_lines
    WHERE order_id = NEW.order_id
    GROUP BY order_id
  )
  UPDATE orders o
  SET 
    status = CASE
      -- All lines delivered
      WHEN ls.delivered_count = ls.total_lines THEN 'delivered'
      -- All lines shipped
      WHEN ls.shipped_count = ls.total_lines THEN 'shipped'
      -- Any line cancelled or denied
      WHEN ls.cancelled_count > 0 OR ls.denied_count > 0 THEN 'cancelled'
      -- Mixed statuses (processing)
      WHEN ls.filled_count > 0 OR ls.shipped_count > 0 THEN 'processing'
      -- All pending
      ELSE 'pending'
    END,
    updated_at = now()
  FROM line_statuses ls
  WHERE o.id = NEW.order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';