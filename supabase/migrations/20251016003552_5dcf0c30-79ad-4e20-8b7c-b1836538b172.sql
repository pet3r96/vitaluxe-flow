-- Add encrypted columns for prescriber credentials
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS npi_encrypted TEXT,
ADD COLUMN IF NOT EXISTS dea_encrypted TEXT,
ADD COLUMN IF NOT EXISTS license_number_encrypted TEXT;

-- Create encryption function for prescriber credentials
CREATE OR REPLACE FUNCTION public.encrypt_prescriber_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');

  -- Encrypt NPI if present
  IF NEW.npi IS NOT NULL AND NEW.npi != '' THEN
    NEW.npi_encrypted := encode(extensions.pgp_sym_encrypt(NEW.npi::text, v_key), 'base64');
    NEW.npi := '[ENCRYPTED]';
  END IF;

  -- Encrypt DEA if present
  IF NEW.dea IS NOT NULL AND NEW.dea != '' THEN
    NEW.dea_encrypted := encode(extensions.pgp_sym_encrypt(NEW.dea::text, v_key), 'base64');
    NEW.dea := '[ENCRYPTED]';
  END IF;

  -- Encrypt License Number if present
  IF NEW.license_number IS NOT NULL AND NEW.license_number != '' THEN
    NEW.license_number_encrypted := encode(extensions.pgp_sym_encrypt(NEW.license_number::text, v_key), 'base64');
    NEW.license_number := '[ENCRYPTED]';
  END IF;

  RETURN NEW;
END;
$$;

-- Create decryption function for prescriber credentials
CREATE OR REPLACE FUNCTION public.decrypt_prescriber_credential(p_encrypted_data text, p_field_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');
  RETURN extensions.pgp_sym_decrypt(decode(p_encrypted_data, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- Create trigger to encrypt prescriber credentials on insert/update
DROP TRIGGER IF EXISTS encrypt_prescriber_credentials_trigger ON public.profiles;
CREATE TRIGGER encrypt_prescriber_credentials_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_prescriber_credentials();

-- Backfill existing data - encrypt existing NPI, DEA, license_number values
DO $$
DECLARE
  v_key text;
  v_record RECORD;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');
  
  FOR v_record IN 
    SELECT id, npi, dea, license_number 
    FROM public.profiles 
    WHERE (npi IS NOT NULL AND npi != '' AND npi != '[ENCRYPTED]')
       OR (dea IS NOT NULL AND dea != '' AND dea != '[ENCRYPTED]')
       OR (license_number IS NOT NULL AND license_number != '' AND license_number != '[ENCRYPTED]')
  LOOP
    UPDATE public.profiles
    SET 
      npi_encrypted = CASE 
        WHEN v_record.npi IS NOT NULL AND v_record.npi != '' AND v_record.npi != '[ENCRYPTED]' 
        THEN encode(extensions.pgp_sym_encrypt(v_record.npi::text, v_key), 'base64')
        ELSE npi_encrypted
      END,
      dea_encrypted = CASE 
        WHEN v_record.dea IS NOT NULL AND v_record.dea != '' AND v_record.dea != '[ENCRYPTED]' 
        THEN encode(extensions.pgp_sym_encrypt(v_record.dea::text, v_key), 'base64')
        ELSE dea_encrypted
      END,
      license_number_encrypted = CASE 
        WHEN v_record.license_number IS NOT NULL AND v_record.license_number != '' AND v_record.license_number != '[ENCRYPTED]' 
        THEN encode(extensions.pgp_sym_encrypt(v_record.license_number::text, v_key), 'base64')
        ELSE license_number_encrypted
      END,
      npi = CASE 
        WHEN v_record.npi IS NOT NULL AND v_record.npi != '' AND v_record.npi != '[ENCRYPTED]' 
        THEN '[ENCRYPTED]'
        ELSE npi
      END,
      dea = CASE 
        WHEN v_record.dea IS NOT NULL AND v_record.dea != '' AND v_record.dea != '[ENCRYPTED]' 
        THEN '[ENCRYPTED]'
        ELSE dea
      END,
      license_number = CASE 
        WHEN v_record.license_number IS NOT NULL AND v_record.license_number != '' AND v_record.license_number != '[ENCRYPTED]' 
        THEN '[ENCRYPTED]'
        ELSE license_number
      END
    WHERE id = v_record.id;
  END LOOP;
END $$;

-- Log the encryption change in audit logs
INSERT INTO public.audit_logs (
  user_id,
  action_type,
  entity_type,
  details
) VALUES (
  NULL,
  'prescriber_credentials_encrypted',
  'profiles',
  jsonb_build_object(
    'message', 'Prescriber credentials (NPI, DEA, License) encrypted for HIPAA compliance',
    'fields_encrypted', ARRAY['npi', 'dea', 'license_number'],
    'encryption_method', 'AES-256 via pgp_sym_encrypt'
  )
);