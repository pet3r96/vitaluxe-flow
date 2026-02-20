-- Step 2: Update defaults and constraints (enum values now committed)

-- Update default on cart_lines
ALTER TABLE cart_lines ALTER COLUMN shipping_speed SET DEFAULT 'first_class';

-- Update default on order_lines
ALTER TABLE order_lines ALTER COLUMN shipping_speed SET DEFAULT 'first_class';

-- Drop and recreate CHECK constraint
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_shipping_speed' 
    AND table_name = 'order_lines'
  ) THEN
    ALTER TABLE order_lines DROP CONSTRAINT valid_shipping_speed;
  END IF;
END $$;

ALTER TABLE order_lines ADD CONSTRAINT valid_shipping_speed 
  CHECK (shipping_speed IN ('ground', '2day', 'overnight', 'priority', 'first_class'));