-- Add provider_id column to order_lines table
ALTER TABLE order_lines 
ADD COLUMN provider_id uuid REFERENCES providers(id);

-- Create index for performance
CREATE INDEX idx_order_lines_provider_id ON order_lines(provider_id);

-- Add comment for documentation
COMMENT ON COLUMN order_lines.provider_id IS 'The provider who prescribed this order line';