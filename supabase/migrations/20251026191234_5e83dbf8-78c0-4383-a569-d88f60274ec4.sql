-- Add structured address fields to cart_lines for better address management
ALTER TABLE cart_lines 
ADD COLUMN IF NOT EXISTS patient_address_street TEXT,
ADD COLUMN IF NOT EXISTS patient_address_city TEXT,
ADD COLUMN IF NOT EXISTS patient_address_state TEXT,
ADD COLUMN IF NOT EXISTS patient_address_zip TEXT,
ADD COLUMN IF NOT EXISTS patient_address_formatted TEXT,
ADD COLUMN IF NOT EXISTS patient_address_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS patient_address_validation_source TEXT;