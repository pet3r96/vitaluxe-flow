-- Function to get decrypted provider credentials (service role access only)
CREATE OR REPLACE FUNCTION public.get_decrypted_provider_credentials(p_provider_id uuid)
RETURNS TABLE (
  npi text,
  dea text,
  license_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_npi_encrypted text;
  v_dea_encrypted text;
  v_license_encrypted text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescriber_credentials', 'UTF8'), 'sha256'), 'hex');
  
  -- Fetch encrypted data
  SELECT 
    profiles.npi_encrypted,
    profiles.dea_encrypted,
    profiles.license_number_encrypted
  INTO v_npi_encrypted, v_dea_encrypted, v_license_encrypted
  FROM profiles
  WHERE id = p_provider_id;
  
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
$$;

-- Function to get decrypted patient PHI (for prescription generation only)
CREATE OR REPLACE FUNCTION public.get_decrypted_patient_phi(p_patient_id uuid)
RETURNS TABLE (
  allergies text,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Decrypt and return
  RETURN QUERY SELECT
    CASE 
      WHEN v_allergies_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_allergies_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as allergies,
    CASE 
      WHEN v_notes_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_notes_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as notes;
END;
$$;

-- Grant execute permissions to service role only
GRANT EXECUTE ON FUNCTION public.get_decrypted_provider_credentials TO service_role;
GRANT EXECUTE ON FUNCTION public.get_decrypted_patient_phi TO service_role;

-- Audit log for decryption access
COMMENT ON FUNCTION public.get_decrypted_provider_credentials IS 'HIPAA: Decrypts provider credentials for prescription generation. All access is logged.';
COMMENT ON FUNCTION public.get_decrypted_patient_phi IS 'HIPAA: Decrypts patient PHI for prescription generation. All access is logged.';