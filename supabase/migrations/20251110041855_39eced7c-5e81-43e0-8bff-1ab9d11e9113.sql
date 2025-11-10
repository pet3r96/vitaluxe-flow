-- Add pharmacy order ID tracking to order_lines table
ALTER TABLE order_lines 
ADD COLUMN IF NOT EXISTS pharmacy_order_id TEXT,
ADD COLUMN IF NOT EXISTS pharmacy_order_metadata JSONB;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_order_id ON order_lines(pharmacy_order_id);

-- Add pharmacy order ID tracking to transmission logs
ALTER TABLE pharmacy_order_transmissions 
ADD COLUMN IF NOT EXISTS pharmacy_order_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pharmacy_transmissions_pharmacy_order_id 
ON pharmacy_order_transmissions(pharmacy_order_id);

-- Add comment for documentation
COMMENT ON COLUMN order_lines.pharmacy_order_id IS 'External pharmacy system order ID (e.g., BareMeds order ID)';
COMMENT ON COLUMN order_lines.pharmacy_order_metadata IS 'Full response from pharmacy system for reference';
COMMENT ON COLUMN pharmacy_order_transmissions.pharmacy_order_id IS 'External pharmacy system order ID from their response';