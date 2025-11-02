-- Create function to return decrypted profile credentials for authorized users
CREATE OR REPLACE FUNCTION public.get_decrypted_profile_credentials(p_user_id uuid)
RETURNS TABLE (
  full_name text,
  email text,
  phone text,
  npi text,
  dea text,
  license_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user has permission to view credentials
  IF NOT EXISTS (
    SELECT 1 FROM public.can_view_credentials(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to view credentials';
  END IF;

  -- Return decrypted credentials
  RETURN QUERY
  SELECT 
    p.full_name,
    p.email,
    p.phone,
    COALESCE(
      CASE 
        WHEN p.npi_encrypted IS NOT NULL AND p.npi_encrypted != '[ENCRYPTED]' 
        THEN pgp_sym_decrypt(p.npi_encrypted::bytea, current_setting('app.settings.encryption_key', true))
        WHEN p.npi IS NOT NULL AND p.npi != '[ENCRYPTED]'
        THEN p.npi
        ELSE NULL
      END,
      ''
    ) as npi,
    COALESCE(
      CASE 
        WHEN p.dea_encrypted IS NOT NULL AND p.dea_encrypted != '[ENCRYPTED]'
        THEN pgp_sym_decrypt(p.dea_encrypted::bytea, current_setting('app.settings.encryption_key', true))
        WHEN p.dea IS NOT NULL AND p.dea != '[ENCRYPTED]'
        THEN p.dea
        ELSE NULL
      END,
      ''
    ) as dea,
    COALESCE(
      CASE 
        WHEN p.license_number_encrypted IS NOT NULL AND p.license_number_encrypted != '[ENCRYPTED]'
        THEN pgp_sym_decrypt(p.license_number_encrypted::bytea, current_setting('app.settings.encryption_key', true))
        WHEN p.license_number IS NOT NULL AND p.license_number != '[ENCRYPTED]'
        THEN p.license_number
        ELSE NULL
      END,
      ''
    ) as license_number
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;

-- Optional: One-time data cleanup to copy real names from name to full_name
UPDATE public.profiles 
SET full_name = name 
WHERE full_name IS NULL 
  AND name IS NOT NULL 
  AND name NOT LIKE '%@%';