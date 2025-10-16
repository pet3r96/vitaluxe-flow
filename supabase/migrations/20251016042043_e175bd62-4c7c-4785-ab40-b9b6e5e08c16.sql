-- Clean up corrupted credential data and fix encryption trigger

-- Step 1: Null out encrypted columns where plaintext is '[ENCRYPTED]'
UPDATE profiles
SET npi_encrypted = NULL
WHERE npi = '[ENCRYPTED]';

UPDATE profiles
SET dea_encrypted = NULL
WHERE dea = '[ENCRYPTED]';

UPDATE profiles
SET license_number_encrypted = NULL
WHERE license_number = '[ENCRYPTED]';

-- Step 2: Clear plaintext placeholders
UPDATE profiles
SET npi = NULL
WHERE npi = '[ENCRYPTED]';

UPDATE profiles
SET dea = NULL
WHERE dea = '[ENCRYPTED]';

UPDATE profiles
SET license_number = NULL
WHERE license_number = '[ENCRYPTED]';

-- Step 3: Update trigger to prevent encrypting invalid values
CREATE OR REPLACE FUNCTION public.encrypt_prescriber_credentials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');

  -- Encrypt NPI only if it's a real value
  IF NEW.npi IS DISTINCT FROM OLD.npi THEN
    IF NEW.npi IS NOT NULL AND NEW.npi != '' AND NEW.npi != '[ENCRYPTED]' THEN
      NEW.npi_encrypted := encode(extensions.pgp_sym_encrypt(NEW.npi::text, v_key), 'base64');
      NEW.npi := '[ENCRYPTED]';
    ELSIF NEW.npi IS NULL OR NEW.npi = '' THEN
      NEW.npi_encrypted := NULL;
      NEW.npi := NULL;
    ELSE
      NEW.npi_encrypted := OLD.npi_encrypted;
    END IF;
  ELSE
    NEW.npi_encrypted := OLD.npi_encrypted;
  END IF;

  -- Encrypt DEA only if it's a real value
  IF NEW.dea IS DISTINCT FROM OLD.dea THEN
    IF NEW.dea IS NOT NULL AND NEW.dea != '' AND NEW.dea != '[ENCRYPTED]' THEN
      NEW.dea_encrypted := encode(extensions.pgp_sym_encrypt(NEW.dea::text, v_key), 'base64');
      NEW.dea := '[ENCRYPTED]';
    ELSIF NEW.dea IS NULL OR NEW.dea = '' THEN
      NEW.dea_encrypted := NULL;
      NEW.dea := NULL;
    ELSE
      NEW.dea_encrypted := OLD.dea_encrypted;
    END IF;
  ELSE
    NEW.dea_encrypted := OLD.dea_encrypted;
  END IF;

  -- Encrypt License Number only if it's a real value
  IF NEW.license_number IS DISTINCT FROM OLD.license_number THEN
    IF NEW.license_number IS NOT NULL AND NEW.license_number != '' AND NEW.license_number != '[ENCRYPTED]' THEN
      NEW.license_number_encrypted := encode(extensions.pgp_sym_encrypt(NEW.license_number::text, v_key), 'base64');
      NEW.license_number := '[ENCRYPTED]';
    ELSIF NEW.license_number IS NULL OR NEW.license_number = '' THEN
      NEW.license_number_encrypted := NULL;
      NEW.license_number := NULL;
    ELSE
      NEW.license_number_encrypted := OLD.license_number_encrypted;
    END IF;
  ELSE
    NEW.license_number_encrypted := OLD.license_number_encrypted;
  END IF;

  RETURN NEW;
END;
$function$;