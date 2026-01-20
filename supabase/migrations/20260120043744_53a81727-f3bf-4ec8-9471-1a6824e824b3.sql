-- Add patient identification fields for controlled substance orders
ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS driver_license_number TEXT;
ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS driver_license_state TEXT;
ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS state_issued_id TEXT;

-- Add schedule code to products table for controlled substance identification
-- Values: '2', '3', '4', '5' (controlled), 'L' (Legend/Rx), 'O' (OTC)
ALTER TABLE products ADD COLUMN IF NOT EXISTS schedule_code TEXT;

-- Add comment for clarity
COMMENT ON COLUMN patient_accounts.driver_license_number IS 'Required for controlled substance orders - VIOS API requirement';
COMMENT ON COLUMN patient_accounts.driver_license_state IS '2-letter state code for driver license';
COMMENT ON COLUMN patient_accounts.state_issued_id IS 'Alternative state-issued ID for controlled substances';
COMMENT ON COLUMN products.schedule_code IS 'DEA schedule code: 2, 3, 4, 5 (controlled), L (Legend/Rx), O (OTC)';