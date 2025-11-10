-- Remove BareMeds-specific configuration values and tighten constraints

-- Reset pharmacies using BareMeds auth back to 'none'
UPDATE pharmacies
SET api_auth_type = 'none'
WHERE api_auth_type = 'baremeds';

-- Delete BareMeds-specific credentials
DELETE FROM pharmacy_api_credentials
WHERE credential_type = 'baremeds_oauth';

-- Restore api_auth_type constraint without BareMeds
ALTER TABLE pharmacies
DROP CONSTRAINT IF EXISTS pharmacies_api_auth_type_check;

ALTER TABLE pharmacies
ADD CONSTRAINT pharmacies_api_auth_type_check
CHECK (api_auth_type IN ('bearer', 'api_key', 'basic', 'none'));

-- Restore credential_type constraint without BareMeds
ALTER TABLE pharmacy_api_credentials
DROP CONSTRAINT IF EXISTS pharmacy_api_credentials_credential_type_check;

ALTER TABLE pharmacy_api_credentials
ADD CONSTRAINT pharmacy_api_credentials_credential_type_check
CHECK (credential_type IN (
  'api_key',
  'bearer_token',
  'basic_auth_username',
  'basic_auth_password'
));

