-- Fix trigger to not overwrite existing encrypted values
CREATE OR REPLACE FUNCTION public.auto_encrypt_pharmacy_credential()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only encrypt if:
  -- 1. Plain text is provided and not the placeholder
  -- 2. AND encrypted column is empty or null
  IF NEW.credential_key IS NOT NULL 
     AND NEW.credential_key != '' 
     AND NEW.credential_key != '[ENCRYPTED]'
     AND (NEW.credential_key_encrypted IS NULL OR NEW.credential_key_encrypted = '') THEN
    NEW.credential_key_encrypted := public.encrypt_pharmacy_credential(NEW.credential_key);
    NEW.credential_key := '[ENCRYPTED]';
  END IF;
  RETURN NEW;
END;
$$;