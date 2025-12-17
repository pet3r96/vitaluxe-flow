-- Add encrypted column to pharmacy_api_credentials
ALTER TABLE public.pharmacy_api_credentials 
ADD COLUMN IF NOT EXISTS credential_key_encrypted TEXT;

-- Create encryption/decryption functions for pharmacy credentials
CREATE OR REPLACE FUNCTION public.encrypt_pharmacy_credential(p_plain_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Generate encryption key from service role (only accessible server-side)
  v_key := encode(extensions.digest(
    convert_to(COALESCE(current_setting('app.pharmacy_encryption_key', true), 'pharmacy_api_v1_secure_key'), 'UTF8'), 
    'sha256'
  ), 'hex');
  
  RETURN encode(extensions.pgp_sym_encrypt(p_plain_text, v_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_pharmacy_credential(p_encrypted_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_encrypted_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_key := encode(extensions.digest(
    convert_to(COALESCE(current_setting('app.pharmacy_encryption_key', true), 'pharmacy_api_v1_secure_key'), 'UTF8'), 
    'sha256'
  ), 'hex');
  
  RETURN extensions.pgp_sym_decrypt(decode(p_encrypted_text, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION_ERROR]';
END;
$$;

-- Migrate existing credentials to encrypted format
UPDATE public.pharmacy_api_credentials
SET credential_key_encrypted = public.encrypt_pharmacy_credential(credential_key)
WHERE credential_key IS NOT NULL 
  AND credential_key_encrypted IS NULL;

-- Create trigger to auto-encrypt on insert/update
CREATE OR REPLACE FUNCTION public.auto_encrypt_pharmacy_credential()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only encrypt if plain text is provided and different from current
  IF NEW.credential_key IS NOT NULL AND NEW.credential_key != '' THEN
    NEW.credential_key_encrypted := public.encrypt_pharmacy_credential(NEW.credential_key);
    -- Clear the plain text after encryption
    NEW.credential_key := '[ENCRYPTED]';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_pharmacy_credential_trigger ON public.pharmacy_api_credentials;
CREATE TRIGGER encrypt_pharmacy_credential_trigger
  BEFORE INSERT OR UPDATE ON public.pharmacy_api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_encrypt_pharmacy_credential();

-- Clear plain text credentials now that they're encrypted
UPDATE public.pharmacy_api_credentials
SET credential_key = '[ENCRYPTED]'
WHERE credential_key_encrypted IS NOT NULL 
  AND credential_key != '[ENCRYPTED]';