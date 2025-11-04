-- Delete orphaned order #8EFCAFBC (has no order_lines)
DELETE FROM orders 
WHERE id = '8efcafbc-ddc8-4b02-9c24-c9cc285e7051'
  AND NOT EXISTS (
    SELECT 1 FROM order_lines WHERE order_id = orders.id
  );

-- Add a function to check if an order has order_lines
CREATE OR REPLACE FUNCTION check_order_has_lines()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow the order to be created first
  -- This check will run on UPDATE after order_lines are added
  IF TG_OP = 'UPDATE' AND NEW.status != 'pending' THEN
    -- If order is moving past pending status, ensure it has order_lines
    IF NOT EXISTS (SELECT 1 FROM order_lines WHERE order_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot update order % - no order_lines exist', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent status changes on orders without order_lines
DROP TRIGGER IF EXISTS ensure_order_has_lines ON orders;
CREATE TRIGGER ensure_order_has_lines
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_order_has_lines();