-- Mark existing GLP products as is_glp1 based on product type
UPDATE products 
SET is_glp1 = true
WHERE product_type_id IN (
  'd1a6ab09-d353-4360-b87f-678aac5b16f4',  -- GLP 1
  '6c1db44c-a66e-4c4a-8042-432dfca869f3',  -- GLP 2
  '4f3d059a-383b-4345-8901-4c33fceb174a'   -- GLP 3
);

-- Add GLP tracking columns to product_types table
ALTER TABLE product_types 
ADD COLUMN IF NOT EXISTS is_glp BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS glp_clinical_statement TEXT;

-- Set GLP product types with default clinical statement
UPDATE product_types 
SET is_glp = true, 
    glp_clinical_statement = 'Compounded for customized dosing to meet individual patient needs per prescriber requirements.'
WHERE name LIKE 'GLP%';

-- Set default clinical statement for products that are already marked as GLP-1 but missing statement
UPDATE products 
SET glp1_clinical_statement = 'Compounded for customized dosing to meet individual patient needs per prescriber requirements.'
WHERE is_glp1 = true AND (glp1_clinical_statement IS NULL OR glp1_clinical_statement = '');