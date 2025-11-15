-- Add index on order_lines(order_id) if not exists (for FK joins)
-- This improves performance when joining orders with order_lines
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id 
ON order_lines (order_id);