-- Drop and recreate get_decrypted_practice_credentials to include DEA
DROP FUNCTION IF EXISTS public.get_decrypted_practice_credentials(uuid);

CREATE FUNCTION public.get_decrypted_practice_credentials(p_practice_id uuid)
RETURNS TABLE(npi text, dea text, license_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
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
  
  -- Fetch encrypted data from profiles table
  SELECT 
    npi_encrypted,
    dea_encrypted,
    license_number_encrypted
  INTO v_npi_encrypted, v_dea_encrypted, v_license_encrypted
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
$$;