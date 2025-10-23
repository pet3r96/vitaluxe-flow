-- Add pharmacy assignment to cart_lines
ALTER TABLE cart_lines 
ADD COLUMN IF NOT EXISTS assigned_pharmacy_id UUID REFERENCES pharmacies(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_cart_lines_assigned_pharmacy 
ON cart_lines(assigned_pharmacy_id);

-- Add comment for documentation
COMMENT ON COLUMN cart_lines.assigned_pharmacy_id IS 
'Pre-assigned pharmacy determined at cart addition time via route-order-to-pharmacy function';