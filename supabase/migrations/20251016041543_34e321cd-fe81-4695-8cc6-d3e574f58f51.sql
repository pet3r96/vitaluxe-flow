-- ============================================================
-- Fix 1: Harden encrypt_prescriber_credentials trigger
-- Only encrypt when field actually changes and is not '[ENCRYPTED]'
-- ============================================================
CREATE OR REPLACE FUNCTION public.encrypt_prescriber_credentials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');

  -- Encrypt NPI only if it changed AND is a real value (not NULL, empty, or '[ENCRYPTED]')
  IF NEW.npi IS DISTINCT FROM OLD.npi 
     AND NEW.npi IS NOT NULL 
     AND NEW.npi != '' 
     AND NEW.npi != '[ENCRYPTED]' THEN
    NEW.npi_encrypted := encode(extensions.pgp_sym_encrypt(NEW.npi::text, v_key), 'base64');
    NEW.npi := '[ENCRYPTED]';
  ELSIF NEW.npi = OLD.npi OR NEW.npi = '[ENCRYPTED]' THEN
    -- Keep existing encrypted value if unchanged
    NEW.npi_encrypted := OLD.npi_encrypted;
  END IF;

  -- Encrypt DEA only if it changed AND is a real value
  IF NEW.dea IS DISTINCT FROM OLD.dea 
     AND NEW.dea IS NOT NULL 
     AND NEW.dea != '' 
     AND NEW.dea != '[ENCRYPTED]' THEN
    NEW.dea_encrypted := encode(extensions.pgp_sym_encrypt(NEW.dea::text, v_key), 'base64');
    NEW.dea := '[ENCRYPTED]';
  ELSIF NEW.dea = OLD.dea OR NEW.dea = '[ENCRYPTED]' THEN
    NEW.dea_encrypted := OLD.dea_encrypted;
  END IF;

  -- Encrypt License Number only if it changed AND is a real value
  IF NEW.license_number IS DISTINCT FROM OLD.license_number 
     AND NEW.license_number IS NOT NULL 
     AND NEW.license_number != '' 
     AND NEW.license_number != '[ENCRYPTED]' THEN
    NEW.license_number_encrypted := encode(extensions.pgp_sym_encrypt(NEW.license_number::text, v_key), 'base64');
    NEW.license_number := '[ENCRYPTED]';
  ELSIF NEW.license_number = OLD.license_number OR NEW.license_number = '[ENCRYPTED]' THEN
    NEW.license_number_encrypted := OLD.license_number_encrypted;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- Fix 2: Clean corrupted ciphertext that decrypts to '[ENCRYPTED]'
-- Set encrypted columns to NULL if they decrypt to the placeholder
-- ============================================================
DO $$
DECLARE
  v_key text;
  v_record RECORD;
  v_cleaned_count INTEGER := 0;
BEGIN
  -- Derive the same encryption key
  v_key := encode(digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');
  
  -- Loop through all profiles with encrypted credentials
  FOR v_record IN 
    SELECT id, npi_encrypted, dea_encrypted, license_number_encrypted 
    FROM profiles 
    WHERE npi_encrypted IS NOT NULL 
       OR dea_encrypted IS NOT NULL 
       OR license_number_encrypted IS NOT NULL
  LOOP
    BEGIN
      -- Check and clean NPI
      IF v_record.npi_encrypted IS NOT NULL THEN
        IF pgp_sym_decrypt(decode(v_record.npi_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
          UPDATE profiles SET npi_encrypted = NULL WHERE id = v_record.id;
          v_cleaned_count := v_cleaned_count + 1;
          RAISE NOTICE 'Cleaned corrupted NPI for profile %', v_record.id;
        END IF;
      END IF;
      
      -- Check and clean DEA
      IF v_record.dea_encrypted IS NOT NULL THEN
        IF pgp_sym_decrypt(decode(v_record.dea_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
          UPDATE profiles SET dea_encrypted = NULL WHERE id = v_record.id;
          v_cleaned_count := v_cleaned_count + 1;
          RAISE NOTICE 'Cleaned corrupted DEA for profile %', v_record.id;
        END IF;
      END IF;
      
      -- Check and clean License Number
      IF v_record.license_number_encrypted IS NOT NULL THEN
        IF pgp_sym_decrypt(decode(v_record.license_number_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
          UPDATE profiles SET license_number_encrypted = NULL WHERE id = v_record.id;
          v_cleaned_count := v_cleaned_count + 1;
          RAISE NOTICE 'Cleaned corrupted License for profile %', v_record.id;
        END IF;
      END IF;
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipped profile % due to decryption error: %', v_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Cleaned % corrupted credential fields', v_cleaned_count;
END $$;

-- ============================================================
-- Fix 3: Add role check to get_decrypted_provider_credentials
-- Ensure only authorized roles can decrypt
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_decrypted_provider_credentials(p_provider_id uuid)
RETURNS TABLE(npi text, dea text, license_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_key text;
  v_user_id uuid;
  v_npi_encrypted text;
  v_dea_encrypted text;
  v_license_encrypted text;
BEGIN
  -- Verify caller has appropriate role
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'doctor'::app_role) OR
    has_role(auth.uid(), 'provider'::app_role) OR
    has_role(auth.uid(), 'pharmacy'::app_role)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin, doctor, provider, or pharmacy can decrypt credentials';
  END IF;

  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');
  
  -- Get user_id from providers table first
  SELECT user_id INTO v_user_id
  FROM providers
  WHERE id = p_provider_id;
  
  -- If no provider found, return NULL values
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  
  -- Fetch encrypted data from profiles using user_id
  SELECT 
    profiles.npi_encrypted,
    profiles.dea_encrypted,
    profiles.license_number_encrypted
  INTO v_npi_encrypted, v_dea_encrypted, v_license_encrypted
  FROM profiles
  WHERE id = v_user_id;
  
  -- Decrypt and return
  RETURN QUERY SELECT
    CASE 
      WHEN v_npi_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_npi_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as npi,
    CASE 
      WHEN v_dea_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_dea_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as dea,
    CASE 
      WHEN v_license_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_license_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as license_number;
END;
$function$;

-- ============================================================
-- Fix 4: Update permissions on decrypt function
-- ============================================================
REVOKE ALL ON FUNCTION public.get_decrypted_provider_credentials(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_decrypted_provider_credentials(uuid) TO authenticated;