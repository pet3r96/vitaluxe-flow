-- Enable pgcrypto extension (required for encryption/decryption)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop and recreate the decryption function with fixes
DROP FUNCTION IF EXISTS public.get_decrypted_profile_credentials(uuid);

CREATE OR REPLACE FUNCTION public.get_decrypted_profile_credentials(p_user_id uuid)
RETURNS TABLE (
  full_name text,
  npi text,
  dea text,
  license_number text,
  phone text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Get encryption key from vault
  encryption_key := current_setting('app.encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'default-key-change-in-production';
  END IF;

  RETURN QUERY
  SELECT 
    -- Full name: use full_name if set, else prescriber_name, else name (if not email)
    COALESCE(
      p.full_name,
      p.prescriber_name,
      CASE WHEN p.name IS NOT NULL AND p.name NOT LIKE '%@%' THEN p.name ELSE NULL END
    ) as full_name,
    
    -- NPI: prefer plain text, fallback to decrypt if encrypted column has data
    CASE 
      WHEN p.npi IS NOT NULL AND p.npi != '[ENCRYPTED]' THEN p.npi
      WHEN p.npi_encrypted IS NOT NULL THEN 
        pgp_sym_decrypt(p.npi_encrypted, encryption_key)
      ELSE NULL
    END as npi,
    
    -- DEA: prefer plain text, fallback to decrypt if encrypted column has data  
    CASE
      WHEN p.dea IS NOT NULL AND p.dea != '[ENCRYPTED]' THEN p.dea
      WHEN p.dea_encrypted IS NOT NULL THEN
        pgp_sym_decrypt(p.dea_encrypted, encryption_key)
      ELSE NULL
    END as dea,
    
    -- License: prefer plain text, fallback to decrypt if encrypted column has data
    CASE
      WHEN p.license_number IS NOT NULL AND p.license_number != '[ENCRYPTED]' THEN p.license_number
      WHEN p.license_number_encrypted IS NOT NULL THEN
        pgp_sym_decrypt(p.license_number_encrypted, encryption_key)
      ELSE NULL
    END as license_number,
    
    -- Phone: plain text only
    p.phone as phone
  FROM profiles p
  WHERE p.id = p_user_id;  -- FIXED: was p.user_id = p_user_id
END;
$$;