-- Add 'delivered' to the order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivered';

-- Update the update_order_status function to handle delivered status
CREATE OR REPLACE FUNCTION public.update_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  WITH line_statuses AS (
    SELECT 
      order_id,
      COUNT(*) AS total_lines,
      COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_count,
      COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_count,
      COUNT(*) FILTER (WHERE status = 'denied') AS denied_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'filled') AS filled_count
    FROM order_lines
    WHERE order_id = NEW.order_id
    GROUP BY order_id
  )
  UPDATE orders o
  SET 
    status = CASE
      WHEN o.status = 'cancelled' THEN 'cancelled'
      -- All delivered → completed
      WHEN ls.delivered_count = ls.total_lines THEN 'completed'
      WHEN ls.denied_count = ls.total_lines THEN 'denied'
      WHEN ls.shipped_count = ls.total_lines THEN 'shipped'
      WHEN ls.filled_count > 0 
        OR ls.shipped_count > 0 
        OR ls.delivered_count > 0
        OR (ls.denied_count > 0 AND ls.denied_count < ls.total_lines) THEN 'processing'
      ELSE 'pending'
    END,
    updated_at = now()
  FROM line_statuses ls
  WHERE o.id = NEW.order_id;

  RETURN NEW;
END;
$$;