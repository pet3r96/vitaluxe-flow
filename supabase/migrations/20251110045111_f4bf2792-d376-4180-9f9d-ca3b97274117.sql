-- Drop the old constraint that doesn't include baremeds_oauth
ALTER TABLE pharmacy_api_credentials 
DROP CONSTRAINT IF EXISTS pharmacy_api_credentials_credential_type_check;

-- Add new constraint with "baremeds_oauth" included
ALTER TABLE pharmacy_api_credentials 
ADD CONSTRAINT pharmacy_api_credentials_credential_type_check 
CHECK (credential_type IN (
  'api_key', 
  'bearer_token', 
  'basic_auth_username', 
  'basic_auth_password',
  'baremeds_oauth'
));