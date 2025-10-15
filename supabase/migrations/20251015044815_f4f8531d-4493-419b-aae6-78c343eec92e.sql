-- Fix search_path for all encryption functions to include extensions schema
-- This resolves "function digest(text, unknown) does not exist" errors

-- Encrypt/decrypt for Plaid
CREATE OR REPLACE FUNCTION public.encrypt_plaid_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'plaid', 'sha256'), 'hex');
  RETURN encode(pgp_sym_encrypt(p_token, v_key), 'base64');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption failed: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_plaid_token(p_encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'plaid', 'sha256'), 'hex');
  RETURN pgp_sym_decrypt(decode(p_encrypted_token, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption failed: %', SQLERRM;
END;
$function$;

-- Patient PHI encryption
CREATE OR REPLACE FUNCTION public.encrypt_patient_phi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'patient_phi', 'sha256'), 'hex');
  
  IF NEW.allergies IS NOT NULL AND NEW.allergies != '' THEN
    NEW.allergies_encrypted := encode(pgp_sym_encrypt(NEW.allergies, v_key), 'base64');
    NEW.allergies := '[ENCRYPTED]';
  END IF;
  
  IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
    NEW.notes_encrypted := encode(pgp_sym_encrypt(NEW.notes, v_key), 'base64');
    NEW.notes := '[ENCRYPTED]';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Prescription data encryption
CREATE OR REPLACE FUNCTION public.encrypt_prescription_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'prescription', 'sha256'), 'hex');
  
  IF NEW.prescription_url IS NOT NULL AND NEW.prescription_url != '' THEN
    NEW.prescription_url_encrypted := encode(pgp_sym_encrypt(NEW.prescription_url, v_key), 'base64');
  END IF;
  
  IF NEW.custom_dosage IS NOT NULL AND NEW.custom_dosage != '' THEN
    NEW.custom_dosage_encrypted := encode(pgp_sym_encrypt(NEW.custom_dosage, v_key), 'base64');
  END IF;
  
  IF NEW.custom_sig IS NOT NULL AND NEW.custom_sig != '' THEN
    NEW.custom_sig_encrypted := encode(pgp_sym_encrypt(NEW.custom_sig, v_key), 'base64');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Cart-line PHI encryption (the one failing on add-to-cart)
CREATE OR REPLACE FUNCTION public.encrypt_cart_line_phi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'cart_phi', 'sha256'), 'hex');
  
  IF NEW.prescription_url IS NOT NULL AND NEW.prescription_url != '' THEN
    NEW.prescription_url_encrypted := encode(pgp_sym_encrypt(NEW.prescription_url, v_key), 'base64');
  END IF;
  
  IF NEW.patient_email IS NOT NULL THEN
    NEW.patient_email_encrypted := encode(pgp_sym_encrypt(NEW.patient_email, v_key), 'base64');
  END IF;
  
  IF NEW.patient_phone IS NOT NULL THEN
    NEW.patient_phone_encrypted := encode(pgp_sym_encrypt(NEW.patient_phone, v_key), 'base64');
  END IF;
  
  IF NEW.patient_address IS NOT NULL THEN
    NEW.patient_address_encrypted := encode(pgp_sym_encrypt(NEW.patient_address, v_key), 'base64');
  END IF;
  
  IF NEW.custom_dosage IS NOT NULL THEN
    NEW.custom_dosage_encrypted := encode(pgp_sym_encrypt(NEW.custom_dosage, v_key), 'base64');
  END IF;
  
  IF NEW.custom_sig IS NOT NULL THEN
    NEW.custom_sig_encrypted := encode(pgp_sym_encrypt(NEW.custom_sig, v_key), 'base64');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Cart PHI decryption helper
CREATE OR REPLACE FUNCTION public.decrypt_cart_phi(p_encrypted_data text, p_field_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'cart_phi', 'sha256'), 'hex');
  RETURN pgp_sym_decrypt(decode(p_encrypted_data, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION ERROR]';
END;
$function$;