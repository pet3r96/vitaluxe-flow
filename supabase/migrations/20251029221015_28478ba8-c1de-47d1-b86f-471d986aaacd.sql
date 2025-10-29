-- Add phone column to pharmacies table
ALTER TABLE pharmacies 
ADD COLUMN IF NOT EXISTS phone text;

-- Add comment for documentation
COMMENT ON COLUMN pharmacies.phone IS 'Primary contact phone number (10 digits, stored without formatting)';