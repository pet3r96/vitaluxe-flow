-- Add pharmacy_id column to products table
ALTER TABLE products 
ADD COLUMN pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_products_pharmacy_id ON products(pharmacy_id);

-- Set all existing products to "Test Pharma" (ID: 22e7801e-f9ff-40f1-a926-968f3a8065ec)
UPDATE products 
SET pharmacy_id = '22e7801e-f9ff-40f1-a926-968f3a8065ec'
WHERE pharmacy_id IS NULL;

-- Add helpful comment
COMMENT ON COLUMN products.pharmacy_id IS 'The pharmacy that fulfills orders for this product';