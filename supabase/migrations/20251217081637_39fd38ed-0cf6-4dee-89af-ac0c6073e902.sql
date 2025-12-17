-- Create batch decryption function for edge functions
CREATE OR REPLACE FUNCTION public.decrypt_pharmacy_credentials_batch(p_pharmacy_id UUID)
RETURNS TABLE(
  id UUID,
  pharmacy_id UUID,
  credential_type TEXT,
  credential_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.pharmacy_id,
    pc.credential_type,
    public.decrypt_pharmacy_credential(pc.credential_key_encrypted) as credential_key
  FROM public.pharmacy_api_credentials pc
  WHERE pc.pharmacy_id = p_pharmacy_id;
END;
$$;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION public.decrypt_pharmacy_credentials_batch(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_pharmacy_credentials_batch(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.decrypt_pharmacy_credentials_batch(UUID) FROM authenticated;