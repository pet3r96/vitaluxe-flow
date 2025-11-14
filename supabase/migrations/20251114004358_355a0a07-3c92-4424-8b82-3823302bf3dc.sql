-- Create efficient function to count provider orders
CREATE OR REPLACE FUNCTION count_provider_orders(p_provider_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT ol.order_id)::INTEGER
  FROM order_lines ol
  INNER JOIN orders o ON o.id = ol.order_id
  WHERE ol.provider_id = p_provider_id
    AND o.payment_status != 'payment_failed'
    AND o.status != 'cancelled';
$$ LANGUAGE SQL STABLE;

-- Add index for provider orders query performance
CREATE INDEX IF NOT EXISTS idx_order_lines_provider_order 
ON order_lines(provider_id, order_id);

-- Create efficient function to count pharmacy orders
CREATE OR REPLACE FUNCTION count_pharmacy_orders(p_pharmacy_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT ol.order_id)::INTEGER
  FROM order_lines ol
  INNER JOIN orders o ON o.id = ol.order_id
  WHERE ol.assigned_pharmacy_id = p_pharmacy_id
    AND o.payment_status != 'payment_failed'
    AND o.status != 'cancelled';
$$ LANGUAGE SQL STABLE;