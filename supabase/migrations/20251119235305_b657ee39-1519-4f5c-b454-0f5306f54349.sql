-- Fix Demo Pharmacy 1 address for shipping
UPDATE pharmacies 
SET 
  address_street = '123 Pharmacy Lane',
  address_city = 'Miami',
  address_state = 'FL',
  address_zip = '33101',
  address_formatted = '123 Pharmacy Lane, Miami, FL 33101',
  phone = '305-555-0100'
WHERE id = 'd5e75179-e66c-450f-8cae-1f4df93b097c';

-- Add check constraint to ensure pharmacies have required address fields for shipping
ALTER TABLE pharmacies ADD CONSTRAINT pharmacies_address_check 
CHECK (
  (address_street IS NOT NULL AND address_city IS NOT NULL AND address_state IS NOT NULL AND address_zip IS NOT NULL)
  OR (address_street IS NULL AND address_city IS NULL AND address_state IS NULL AND address_zip IS NULL)
);

COMMENT ON CONSTRAINT pharmacies_address_check ON pharmacies IS 'Ensures pharmacies have complete address or no address (prevents partial addresses)';
