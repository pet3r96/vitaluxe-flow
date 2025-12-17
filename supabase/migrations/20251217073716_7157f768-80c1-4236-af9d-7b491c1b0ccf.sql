-- Extend allowed credential types for pharmacy_api_credentials
ALTER TABLE public.pharmacy_api_credentials
  DROP CONSTRAINT IF EXISTS pharmacy_api_credentials_credential_type_check;

ALTER TABLE public.pharmacy_api_credentials
  ADD CONSTRAINT pharmacy_api_credentials_credential_type_check
  CHECK (
    credential_type = ANY (
      ARRAY[
        'api_key'::text,
        'bearer_token'::text,
        'basic_auth_username'::text,
        'basic_auth_password'::text,
        'baremeds_oauth'::text,
        'vios_client_key'::text,
        'vios_client_secret'::text
      ]
    )
  );