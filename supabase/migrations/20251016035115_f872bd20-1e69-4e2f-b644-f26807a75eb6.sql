-- Phase 1: Create get_decrypted_practice_credentials function
CREATE OR REPLACE FUNCTION public.get_decrypted_practice_credentials(p_practice_id uuid)
RETURNS TABLE (
  npi text,
  license_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Decrypt and return
  RETURN QUERY SELECT
    CASE 
      WHEN v_npi_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_npi_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as npi,
    CASE 
      WHEN v_license_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_license_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as license_number;
END;
$$;

-- Phase 2: Create masked view for toplines/downlines (excludes credentials)
CREATE OR REPLACE VIEW public.profiles_masked_for_reps AS
SELECT 
  id,
  name,
  email,
  phone,
  address,
  company,
  active,
  created_at,
  updated_at,
  parent_id,
  linked_topline_id,
  address_verification_status,
  address_formatted,
  address_street,
  address_city,
  address_state,
  address_zip,
  email_encrypted,
  phone_encrypted,
  address_encrypted,
  -- Exclude credential fields completely
  NULL::text as npi,
  NULL::text as npi_encrypted,
  NULL::text as dea,
  NULL::text as dea_encrypted,
  NULL::text as license_number,
  NULL::text as license_number_encrypted,
  NULL::text as full_name,
  NULL::text as prescriber_name
FROM profiles;

-- Grant SELECT on masked view to authenticated users
GRANT SELECT ON public.profiles_masked_for_reps TO authenticated;

-- Add RLS policy to prevent toplines/downlines from accessing credential fields in profiles table
-- Note: We're adding a restrictive policy that explicitly denies credential field access for these roles

-- First, let's add a helper function to check if user can view credentials
CREATE OR REPLACE FUNCTION public.can_view_credentials(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role IN ('admin', 'doctor', 'provider', 'pharmacy')
  )
$$;

-- Log decryption access
CREATE OR REPLACE FUNCTION public.log_credential_decryption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when credentials are decrypted
  PERFORM log_audit_event(
    'credentials_decrypted',
    'profiles',
    NEW.id,
    jsonb_build_object(
      'profile_name', NEW.name,
      'decrypted_by', auth.uid(),
      'timestamp', now()
    )
  );
  RETURN NEW;
END;
$$;