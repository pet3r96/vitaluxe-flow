-- Add VIOS Product ID and GLP-1 columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS vios_lf_product_id TEXT;

COMMENT ON COLUMN products.vios_lf_product_id IS 
'VIOS lfProductId for direct product mapping - avoids order clarifications';

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_glp1 BOOLEAN DEFAULT FALSE;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS glp1_clinical_statement TEXT;

COMMENT ON COLUMN products.is_glp1 IS 'Indicates if this is a GLP-1 medication requiring clinical difference statement';
COMMENT ON COLUMN products.glp1_clinical_statement IS 'Required clinical difference statement for GLP-1 medications per FDA regulations';