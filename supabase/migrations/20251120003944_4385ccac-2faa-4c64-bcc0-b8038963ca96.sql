-- Fix shipping_speed column to have a default value
-- This prevents NOT NULL constraint violations during order placement

-- Add default value for shipping_speed in order_lines table
ALTER TABLE order_lines 
  ALTER COLUMN shipping_speed SET DEFAULT 'ground';

-- Drop existing constraint if it exists
ALTER TABLE order_lines
  DROP CONSTRAINT IF EXISTS valid_shipping_speed;

-- Add check constraint to ensure valid shipping speeds
ALTER TABLE order_lines
  ADD CONSTRAINT valid_shipping_speed 
  CHECK (shipping_speed IN ('ground', '2day', 'overnight'));

COMMENT ON CONSTRAINT valid_shipping_speed ON order_lines IS 
'Ensures shipping_speed is one of the valid values: ground, 2day, or overnight';

COMMENT ON COLUMN order_lines.shipping_speed IS 
'Shipping speed for this order line. Defaults to ground if not specified. Valid values: ground, 2day, overnight';