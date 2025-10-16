-- Fix get_decrypted_provider_credentials to accept provider.id and resolve user_id
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
  v_user_id uuid;
  v_npi_encrypted text;
  v_dea_encrypted text;
  v_license_encrypted text;
BEGIN
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
$$;