-- Add dosage_form column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS dosage_form text;

-- Add comment for documentation
COMMENT ON COLUMN products.dosage_form IS 'The form of the medication (e.g., cream, injection, troche, capsule, tablet, nasal spray, topical gel, sublingual)';