-- Add test mode flag to pharmacies table for VIOS and other API integrations
ALTER TABLE pharmacies 
ADD COLUMN IF NOT EXISTS api_test_mode BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN pharmacies.api_test_mode IS 'When true, orders sent to this pharmacy API will be marked as test orders (isTestOrder=true for VIOS)';