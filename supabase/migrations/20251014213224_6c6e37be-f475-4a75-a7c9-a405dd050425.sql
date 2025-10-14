-- Create product_type enum
CREATE TYPE product_type AS ENUM (
  'Vitamins',
  'R & D Products',
  'Peptides',
  'GLP 1',
  'GLP 2',
  'GLP 3',
  'Supplies',
  'Vitamin IV''s'
);

-- Add product_type column to products table with default
ALTER TABLE products 
ADD COLUMN product_type product_type DEFAULT 'Peptides';

-- Update all existing products to 'Peptides'
UPDATE products SET product_type = 'Peptides';

-- Make product_type required
ALTER TABLE products 
ALTER COLUMN product_type SET NOT NULL;