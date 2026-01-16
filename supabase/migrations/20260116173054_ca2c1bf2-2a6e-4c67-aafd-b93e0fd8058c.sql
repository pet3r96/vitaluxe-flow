-- Add product_code column to product_variants table for pharmacy API matching
ALTER TABLE product_variants 
ADD COLUMN product_code TEXT;

COMMENT ON COLUMN product_variants.product_code IS 
  'Pharmacy-specific product code (Med ID) for API matching - only visible to admins and pharmacy users';