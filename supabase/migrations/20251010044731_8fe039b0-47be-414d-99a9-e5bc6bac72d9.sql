-- Add provider_id column to cart_lines table
ALTER TABLE cart_lines 
ADD COLUMN provider_id uuid REFERENCES providers(id);

-- Create an index for better query performance
CREATE INDEX idx_cart_lines_provider_id ON cart_lines(provider_id);

-- Add comment for documentation
COMMENT ON COLUMN cart_lines.provider_id IS 'The provider who is prescribing this product';