-- Comprehensive cleanup of all [ENCRYPTED] placeholders and hardening triggers/RPCs

-- ============================================================================
-- PART 1: Clean up patients table (allergies and notes)
-- ============================================================================

-- Null out encrypted columns where plaintext is '[ENCRYPTED]'
UPDATE patients
SET allergies_encrypted = NULL
WHERE allergies = '[ENCRYPTED]';

UPDATE patients
SET notes_encrypted = NULL
WHERE notes = '[ENCRYPTED]';

-- Clear plaintext placeholders
UPDATE patients
SET allergies = NULL
WHERE allergies = '[ENCRYPTED]';

UPDATE patients
SET notes = NULL
WHERE notes = '[ENCRYPTED]';

-- Safety cleanup: decrypt existing ciphertext and NULL if it equals '[ENCRYPTED]'
DO $$
DECLARE
  v_key text;
  v_record RECORD;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'patient_phi', 'UTF8'), 'sha256'), 'hex');
  
  -- Check allergies_encrypted
  FOR v_record IN SELECT id, allergies_encrypted FROM patients WHERE allergies_encrypted IS NOT NULL
  LOOP
    BEGIN
      IF extensions.pgp_sym_decrypt(decode(v_record.allergies_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
        UPDATE patients SET allergies_encrypted = NULL, allergies = NULL WHERE id = v_record.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
  
  -- Check notes_encrypted
  FOR v_record IN SELECT id, notes_encrypted FROM patients WHERE notes_encrypted IS NOT NULL
  LOOP
    BEGIN
      IF extensions.pgp_sym_decrypt(decode(v_record.notes_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
        UPDATE patients SET notes_encrypted = NULL, notes = NULL WHERE id = v_record.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: Safety cleanup for profiles (in case previous migration missed some)
-- ============================================================================

DO $$
DECLARE
  v_key text;
  v_record RECORD;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');
  
  -- Check npi_encrypted
  FOR v_record IN SELECT id, npi_encrypted FROM profiles WHERE npi_encrypted IS NOT NULL
  LOOP
    BEGIN
      IF extensions.pgp_sym_decrypt(decode(v_record.npi_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
        UPDATE profiles SET npi_encrypted = NULL, npi = NULL WHERE id = v_record.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
  
  -- Check dea_encrypted
  FOR v_record IN SELECT id, dea_encrypted FROM profiles WHERE dea_encrypted IS NOT NULL
  LOOP
    BEGIN
      IF extensions.pgp_sym_decrypt(decode(v_record.dea_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
        UPDATE profiles SET dea_encrypted = NULL, dea = NULL WHERE id = v_record.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
  
  -- Check license_number_encrypted
  FOR v_record IN SELECT id, license_number_encrypted FROM profiles WHERE license_number_encrypted IS NOT NULL
  LOOP
    BEGIN
      IF extensions.pgp_sym_decrypt(decode(v_record.license_number_encrypted, 'base64'), v_key) = '[ENCRYPTED]' THEN
        UPDATE profiles SET license_number_encrypted = NULL, license_number = NULL WHERE id = v_record.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PART 3: Update encrypt_patient_phi trigger to prevent re-encrypting placeholders
-- ============================================================================

CREATE OR REPLACE FUNCTION public.encrypt_patient_phi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'patient_phi', 'UTF8'), 'sha256'), 'hex');

  -- Encrypt allergies only if it's a real value
  IF NEW.allergies IS DISTINCT FROM OLD.allergies THEN
    IF NEW.allergies IS NOT NULL AND NEW.allergies != '' AND NEW.allergies != '[ENCRYPTED]' THEN
      NEW.allergies_encrypted := encode(extensions.pgp_sym_encrypt(NEW.allergies::text, v_key), 'base64');
      NEW.allergies := '[ENCRYPTED]';
    ELSIF NEW.allergies IS NULL OR NEW.allergies = '' THEN
      NEW.allergies_encrypted := NULL;
      NEW.allergies := NULL;
    ELSE
      NEW.allergies_encrypted := OLD.allergies_encrypted;
    END IF;
  ELSE
    NEW.allergies_encrypted := OLD.allergies_encrypted;
  END IF;

  -- Encrypt notes only if it's a real value
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    IF NEW.notes IS NOT NULL AND NEW.notes != '' AND NEW.notes != '[ENCRYPTED]' THEN
      NEW.notes_encrypted := encode(extensions.pgp_sym_encrypt(NEW.notes::text, v_key), 'base64');
      NEW.notes := '[ENCRYPTED]';
    ELSIF NEW.notes IS NULL OR NEW.notes = '' THEN
      NEW.notes_encrypted := NULL;
      NEW.notes := NULL;
    ELSE
      NEW.notes_encrypted := OLD.notes_encrypted;
    END IF;
  ELSE
    NEW.notes_encrypted := OLD.notes_encrypted;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- PART 4: Update RPCs to normalize return values (hide [ENCRYPTED] placeholder)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_decrypted_provider_credentials(p_provider_id uuid)
RETURNS TABLE(npi text, dea text, license_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Decrypt and return, using NULLIF to hide [ENCRYPTED] placeholder
  RETURN QUERY SELECT
    NULLIF(
      CASE 
        WHEN v_npi_encrypted IS NOT NULL 
        THEN extensions.pgp_sym_decrypt(decode(v_npi_encrypted, 'base64'), v_key)
        ELSE NULL
      END,
      '[ENCRYPTED]'
    )::text as npi,
    NULLIF(
      CASE 
        WHEN v_dea_encrypted IS NOT NULL 
        THEN extensions.pgp_sym_decrypt(decode(v_dea_encrypted, 'base64'), v_key)
        ELSE NULL
      END,
      '[ENCRYPTED]'
    )::text as dea,
    NULLIF(
      CASE 
        WHEN v_license_encrypted IS NOT NULL 
        THEN extensions.pgp_sym_decrypt(decode(v_license_encrypted, 'base64'), v_key)
        ELSE NULL
      END,
      '[ENCRYPTED]'
    )::text as license_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decrypted_patient_phi(p_patient_id uuid)
RETURNS TABLE(allergies text, notes text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_allergies_encrypted text;
  v_notes_encrypted text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'patient_phi', 'UTF8'), 'sha256'), 'hex');
  
  -- Fetch encrypted data
  SELECT 
    patients.allergies_encrypted,
    patients.notes_encrypted
  INTO v_allergies_encrypted, v_notes_encrypted
  FROM patients
  WHERE id = p_patient_id;
  
  -- Decrypt and return, using NULLIF to hide [ENCRYPTED] placeholder
  RETURN QUERY SELECT
    NULLIF(
      CASE 
        WHEN v_allergies_encrypted IS NOT NULL 
        THEN extensions.pgp_sym_decrypt(decode(v_allergies_encrypted, 'base64'), v_key)
        ELSE NULL
      END,
      '[ENCRYPTED]'
    )::text as allergies,
    NULLIF(
      CASE 
        WHEN v_notes_encrypted IS NOT NULL 
        THEN extensions.pgp_sym_decrypt(decode(v_notes_encrypted, 'base64'), v_key)
        ELSE NULL
      END,
      '[ENCRYPTED]'
    )::text as notes;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decrypted_practice_credentials(p_practice_id uuid)
RETURNS TABLE(npi text, license_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_npi_encrypted text;
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
  
  -- Fetch encrypted data from profiles table
  SELECT 
    npi_encrypted,
    license_number_encrypted
  INTO v_npi_encrypted, v_license_encrypted
  FROM profiles
  WHERE id = p_practice_id;
  
  -- Decrypt and return, using NULLIF to hide [ENCRYPTED] placeholder
  RETURN QUERY SELECT
    NULLIF(
      CASE 
        WHEN v_npi_encrypted IS NOT NULL 
        THEN extensions.pgp_sym_decrypt(decode(v_npi_encrypted, 'base64'), v_key)
        ELSE NULL
      END,
      '[ENCRYPTED]'
    )::text as npi,
    NULLIF(
      CASE 
        WHEN v_license_encrypted IS NOT NULL 
        THEN extensions.pgp_sym_decrypt(decode(v_license_encrypted, 'base64'), v_key)
        ELSE NULL
      END,
      '[ENCRYPTED]'
    )::text as license_number;
END;
$function$;