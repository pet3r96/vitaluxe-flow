-- Add gender_at_birth column to cart_lines table
ALTER TABLE cart_lines
ADD COLUMN IF NOT EXISTS gender_at_birth TEXT;

-- Add gender_at_birth column to order_lines table  
ALTER TABLE order_lines
ADD COLUMN IF NOT EXISTS gender_at_birth TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_lines_gender ON cart_lines(gender_at_birth);
CREATE INDEX IF NOT EXISTS idx_order_lines_gender ON order_lines(gender_at_birth);

-- Add comments for documentation
COMMENT ON COLUMN cart_lines.gender_at_birth IS 'Gender at birth from patient_accounts (m/f/u) - copied to order_lines on checkout';
COMMENT ON COLUMN order_lines.gender_at_birth IS 'Gender at birth from patient_accounts (m/f/u) - used for pharmacy API submissions';