-- Fix the update_order_status function to use correct enum values and preserve cancelled orders
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
      WHEN ls.denied_count = ls.total_lines THEN 'denied'
      WHEN ls.shipped_count = ls.total_lines THEN 'shipped'
      WHEN ls.filled_count > 0 
        OR ls.shipped_count > 0 
        OR (ls.denied_count > 0 AND ls.denied_count < ls.total_lines) THEN 'processing'
      ELSE 'pending'
    END,
    updated_at = now()
  FROM line_statuses ls
  WHERE o.id = NEW.order_id;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_update_order_status ON order_lines;
CREATE TRIGGER trigger_update_order_status
  AFTER INSERT OR UPDATE OF status
  ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status();

-- Backfill all existing orders to sync their status with order lines
WITH line_statuses AS (
  SELECT 
    order_id,
    COUNT(*) AS total_lines,
    COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_count,
    COUNT(*) FILTER (WHERE status = 'denied') AS denied_count,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'filled') AS filled_count
  FROM order_lines
  GROUP BY order_id
)
UPDATE orders o
SET 
  status = CASE
    WHEN o.status = 'cancelled' THEN 'cancelled'
    WHEN ls.denied_count = ls.total_lines THEN 'denied'
    WHEN ls.shipped_count = ls.total_lines THEN 'shipped'
    WHEN ls.filled_count > 0 
      OR ls.shipped_count > 0 
      OR (ls.denied_count > 0 AND ls.denied_count < ls.total_lines) THEN 'processing'
    ELSE 'pending'
  END,
  updated_at = now()
FROM line_statuses ls
WHERE o.id = ls.order_id;