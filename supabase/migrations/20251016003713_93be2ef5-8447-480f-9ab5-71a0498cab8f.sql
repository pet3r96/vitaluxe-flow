-- Add encrypted columns for patient contact info in order_lines
ALTER TABLE public.order_lines
ADD COLUMN IF NOT EXISTS patient_email_encrypted TEXT,
ADD COLUMN IF NOT EXISTS patient_phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS patient_address_encrypted TEXT;

-- Update encryption function to include patient contact fields
CREATE OR REPLACE FUNCTION public.encrypt_prescription_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescription', 'UTF8'), 'sha256'), 'hex');

  -- Encrypt prescription URL if present
  IF NEW.prescription_url IS NOT NULL AND NEW.prescription_url != '' THEN
    NEW.prescription_url_encrypted := encode(extensions.pgp_sym_encrypt(NEW.prescription_url::text, v_key), 'base64');
  END IF;

  -- Encrypt custom dosage if present
  IF NEW.custom_dosage IS NOT NULL AND NEW.custom_dosage != '' THEN
    NEW.custom_dosage_encrypted := encode(extensions.pgp_sym_encrypt(NEW.custom_dosage::text, v_key), 'base64');
  END IF;

  -- Encrypt custom sig if present
  IF NEW.custom_sig IS NOT NULL AND NEW.custom_sig != '' THEN
    NEW.custom_sig_encrypted := encode(extensions.pgp_sym_encrypt(NEW.custom_sig::text, v_key), 'base64');
  END IF;

  -- Encrypt patient email if present
  IF NEW.patient_email IS NOT NULL AND NEW.patient_email != '' AND NEW.patient_email != '[ENCRYPTED]' THEN
    NEW.patient_email_encrypted := encode(extensions.pgp_sym_encrypt(NEW.patient_email::text, v_key), 'base64');
    NEW.patient_email := '[ENCRYPTED]';
  END IF;

  -- Encrypt patient phone if present
  IF NEW.patient_phone IS NOT NULL AND NEW.patient_phone != '' AND NEW.patient_phone != '[ENCRYPTED]' THEN
    NEW.patient_phone_encrypted := encode(extensions.pgp_sym_encrypt(NEW.patient_phone::text, v_key), 'base64');
    NEW.patient_phone := '[ENCRYPTED]';
  END IF;

  -- Encrypt patient address if present
  IF NEW.patient_address IS NOT NULL AND NEW.patient_address != '' AND NEW.patient_address != '[ENCRYPTED]' THEN
    NEW.patient_address_encrypted := encode(extensions.pgp_sym_encrypt(NEW.patient_address::text, v_key), 'base64');
    NEW.patient_address := '[ENCRYPTED]';
  END IF;

  RETURN NEW;
END;
$$;

-- Create decryption function for order line contact data
CREATE OR REPLACE FUNCTION public.decrypt_order_line_contact(p_encrypted_data text, p_field_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescription', 'UTF8'), 'sha256'), 'hex');
  RETURN extensions.pgp_sym_decrypt(decode(p_encrypted_data, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- Backfill existing order_lines data - encrypt patient contact info
DO $$
DECLARE
  v_key text;
  v_record RECORD;
  v_count INTEGER := 0;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'prescription', 'UTF8'), 'sha256'), 'hex');
  
  FOR v_record IN 
    SELECT id, patient_email, patient_phone, patient_address
    FROM public.order_lines 
    WHERE (patient_email IS NOT NULL AND patient_email != '' AND patient_email != '[ENCRYPTED]')
       OR (patient_phone IS NOT NULL AND patient_phone != '' AND patient_phone != '[ENCRYPTED]')
       OR (patient_address IS NOT NULL AND patient_address != '' AND patient_address != '[ENCRYPTED]')
  LOOP
    UPDATE public.order_lines
    SET 
      patient_email_encrypted = CASE 
        WHEN v_record.patient_email IS NOT NULL AND v_record.patient_email != '' AND v_record.patient_email != '[ENCRYPTED]' 
        THEN encode(extensions.pgp_sym_encrypt(v_record.patient_email::text, v_key), 'base64')
        ELSE patient_email_encrypted
      END,
      patient_phone_encrypted = CASE 
        WHEN v_record.patient_phone IS NOT NULL AND v_record.patient_phone != '' AND v_record.patient_phone != '[ENCRYPTED]' 
        THEN encode(extensions.pgp_sym_encrypt(v_record.patient_phone::text, v_key), 'base64')
        ELSE patient_phone_encrypted
      END,
      patient_address_encrypted = CASE 
        WHEN v_record.patient_address IS NOT NULL AND v_record.patient_address != '' AND v_record.patient_address != '[ENCRYPTED]' 
        THEN encode(extensions.pgp_sym_encrypt(v_record.patient_address::text, v_key), 'base64')
        ELSE patient_address_encrypted
      END,
      patient_email = CASE 
        WHEN v_record.patient_email IS NOT NULL AND v_record.patient_email != '' AND v_record.patient_email != '[ENCRYPTED]' 
        THEN '[ENCRYPTED]'
        ELSE patient_email
      END,
      patient_phone = CASE 
        WHEN v_record.patient_phone IS NOT NULL AND v_record.patient_phone != '' AND v_record.patient_phone != '[ENCRYPTED]' 
        THEN '[ENCRYPTED]'
        ELSE patient_phone
      END,
      patient_address = CASE 
        WHEN v_record.patient_address IS NOT NULL AND v_record.patient_address != '' AND v_record.patient_address != '[ENCRYPTED]' 
        THEN '[ENCRYPTED]'
        ELSE patient_address
      END
    WHERE id = v_record.id;
    
    v_count := v_count + 1;
  END LOOP;

  -- Log the encryption change in audit logs
  INSERT INTO public.audit_logs (
    user_id,
    action_type,
    entity_type,
    details
  ) VALUES (
    NULL,
    'order_line_contact_encrypted',
    'order_lines',
    jsonb_build_object(
      'message', 'Patient contact info encrypted in order_lines for HIPAA compliance',
      'fields_encrypted', ARRAY['patient_email', 'patient_phone', 'patient_address'],
      'encryption_method', 'AES-256 via pgp_sym_encrypt',
      'records_encrypted', v_count
    )
  );
END $$;