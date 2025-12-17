
-- Create a service-role version of decrypt function that doesn't require auth.uid()
CREATE OR REPLACE FUNCTION public.decrypt_order_line_contact_service(p_order_line_id uuid)
RETURNS TABLE(
  patient_email text,
  patient_phone text,
  patient_address text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_email_encrypted text;
  v_phone_encrypted text;
  v_address_encrypted text;
BEGIN
  -- This function is meant to be called with service role only
  -- The SECURITY DEFINER + service role key ensures proper access
  
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescription', 'UTF8'), 'sha256'), 'hex');
  
  -- Fetch encrypted data from order_lines table
  SELECT 
    ol.patient_email_encrypted,
    ol.patient_phone_encrypted,
    ol.patient_address_encrypted
  INTO v_email_encrypted, v_phone_encrypted, v_address_encrypted
  FROM order_lines ol
  WHERE ol.id = p_order_line_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Decrypt and return
  RETURN QUERY SELECT
    CASE 
      WHEN v_email_encrypted IS NOT NULL AND v_email_encrypted != ''
      THEN extensions.pgp_sym_decrypt(decode(v_email_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text,
    CASE 
      WHEN v_phone_encrypted IS NOT NULL AND v_phone_encrypted != ''
      THEN extensions.pgp_sym_decrypt(decode(v_phone_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text,
    CASE 
      WHEN v_address_encrypted IS NOT NULL AND v_address_encrypted != ''
      THEN extensions.pgp_sym_decrypt(decode(v_address_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Decryption error: %', SQLERRM;
    RETURN;
END;
$$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION public.decrypt_order_line_contact_service(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_order_line_contact_service(uuid) TO service_role;
