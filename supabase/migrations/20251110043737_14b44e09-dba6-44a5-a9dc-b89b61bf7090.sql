-- Add 'baremeds' to allowed api_auth_type values
-- This fixes the constraint violation when saving BareMeds OAuth configuration

-- Drop the existing constraint
ALTER TABLE pharmacies 
DROP CONSTRAINT IF EXISTS pharmacies_api_auth_type_check;

-- Add new constraint with 'baremeds' included
ALTER TABLE pharmacies 
ADD CONSTRAINT pharmacies_api_auth_type_check 
CHECK (api_auth_type IN ('bearer', 'api_key', 'basic', 'none', 'baremeds'));