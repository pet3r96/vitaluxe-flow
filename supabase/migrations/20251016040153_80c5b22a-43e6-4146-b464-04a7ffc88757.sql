-- Create RPC function to decrypt order line contact information (patient email/phone/address)
CREATE OR REPLACE FUNCTION public.get_decrypted_order_line_contact(p_order_line_id uuid)
RETURNS TABLE (patient_email text, patient_phone text, patient_address text)
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
  -- Verify caller has appropriate role (HIPAA compliance)
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'doctor'::app_role) OR
    has_role(auth.uid(), 'provider'::app_role) OR
    has_role(auth.uid(), 'pharmacy'::app_role)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin, doctor, provider, or pharmacy can decrypt patient contact information';
  END IF;

  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescription', 'UTF8'), 'sha256'), 'hex');
  
  -- Fetch encrypted data from order_lines table
  SELECT 
    patient_email_encrypted,
    patient_phone_encrypted,
    patient_address_encrypted
  INTO v_email_encrypted, v_phone_encrypted, v_address_encrypted
  FROM order_lines
  WHERE id = p_order_line_id;
  
  -- Decrypt and return
  RETURN QUERY SELECT
    CASE 
      WHEN v_email_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_email_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as patient_email,
    CASE 
      WHEN v_phone_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_phone_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as patient_phone,
    CASE 
      WHEN v_address_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(decode(v_address_encrypted, 'base64'), v_key)
      ELSE NULL
    END::text as patient_address;
END;
$$;

COMMENT ON FUNCTION public.get_decrypted_order_line_contact IS 'HIPAA-compliant function to decrypt patient contact information from order lines. Restricted to authorized roles only. All access should be logged via audit system.';