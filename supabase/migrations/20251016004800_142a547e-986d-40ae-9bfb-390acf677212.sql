-- ============================================================================
-- COMPREHENSIVE SECURITY IMPLEMENTATION - ALL PRIORITIES
-- ============================================================================
-- Priority 1: Patient PHI Backfill
-- Priority 3: 2FA Phone Number Encryption
-- Priority 5: Profile Contact Encryption
-- ============================================================================

-- ============================================================================
-- PRIORITY 1: BACKFILL PATIENT PHI ENCRYPTION
-- ============================================================================
-- Encrypt existing patient allergies and notes that are in plaintext

UPDATE patients
SET 
  allergies_encrypted = encode(extensions.pgp_sym_encrypt(
    allergies::text, 
    encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'patient_phi', 'UTF8'), 'sha256'), 'hex')
  ), 'base64'),
  allergies = '[ENCRYPTED]'
WHERE allergies IS NOT NULL 
  AND allergies != '[ENCRYPTED]'
  AND allergies != '';

UPDATE patients
SET 
  notes_encrypted = encode(extensions.pgp_sym_encrypt(
    notes::text, 
    encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'patient_phi', 'UTF8'), 'sha256'), 'hex')
  ), 'base64'),
  notes = '[ENCRYPTED]'
WHERE notes IS NOT NULL 
  AND notes != '[ENCRYPTED]'
  AND notes != '';

-- Log the backfill event
INSERT INTO audit_logs (action_type, entity_type, details)
VALUES (
  'patient_phi_backfill',
  'patients',
  jsonb_build_object(
    'encrypted_allergies', (SELECT COUNT(*) FROM patients WHERE allergies = '[ENCRYPTED]'),
    'encrypted_notes', (SELECT COUNT(*) FROM patients WHERE notes = '[ENCRYPTED]'),
    'timestamp', now()
  )
);

-- ============================================================================
-- PRIORITY 3: 2FA PHONE NUMBER ENCRYPTION
-- ============================================================================

-- Add encrypted phone number column
ALTER TABLE user_2fa_settings 
ADD COLUMN IF NOT EXISTS phone_number_encrypted TEXT;

-- Create encryption function for 2FA phone numbers
CREATE OR REPLACE FUNCTION encrypt_2fa_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || '2fa_phone', 'UTF8'), 'sha256'), 'hex');

  -- Encrypt phone number if present and not already encrypted
  IF NEW.phone_number IS NOT NULL AND NEW.phone_number != '[ENCRYPTED]' AND NEW.phone_number != '' THEN
    NEW.phone_number_encrypted := encode(extensions.pgp_sym_encrypt(NEW.phone_number::text, v_key), 'base64');
    NEW.phone_number := '[ENCRYPTED]';
  END IF;

  RETURN NEW;
END;
$$;

-- Create decryption function for 2FA phone numbers
CREATE OR REPLACE FUNCTION decrypt_2fa_phone(p_encrypted_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || '2fa_phone', 'UTF8'), 'sha256'), 'hex');
  RETURN extensions.pgp_sym_decrypt(decode(p_encrypted_phone, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- Create trigger for automatic encryption
DROP TRIGGER IF EXISTS encrypt_2fa_phone_trigger ON user_2fa_settings;
CREATE TRIGGER encrypt_2fa_phone_trigger
  BEFORE INSERT OR UPDATE ON user_2fa_settings
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_2fa_phone();

-- Backfill existing 2FA phone numbers
UPDATE user_2fa_settings
SET 
  phone_number_encrypted = encode(extensions.pgp_sym_encrypt(
    phone_number::text, 
    encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || '2fa_phone', 'UTF8'), 'sha256'), 'hex')
  ), 'base64'),
  phone_number = '[ENCRYPTED]'
WHERE phone_number IS NOT NULL 
  AND phone_number != '[ENCRYPTED]'
  AND phone_number != '';

-- ============================================================================
-- PRIORITY 5: PROFILE CONTACT ENCRYPTION (Defense in Depth)
-- ============================================================================

-- Add encrypted columns for profile contact information
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS address_encrypted TEXT;

-- Create encryption function for profile contact info
CREATE OR REPLACE FUNCTION encrypt_profile_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'profile_contact', 'UTF8'), 'sha256'), 'hex');

  -- Encrypt email if present
  IF NEW.email IS NOT NULL AND NEW.email != '[ENCRYPTED]' AND NEW.email != '' THEN
    NEW.email_encrypted := encode(extensions.pgp_sym_encrypt(NEW.email::text, v_key), 'base64');
  END IF;

  -- Encrypt phone if present
  IF NEW.phone IS NOT NULL AND NEW.phone != '[ENCRYPTED]' AND NEW.phone != '' THEN
    NEW.phone_encrypted := encode(extensions.pgp_sym_encrypt(NEW.phone::text, v_key), 'base64');
  END IF;

  -- Encrypt address if present
  IF NEW.address IS NOT NULL AND NEW.address != '[ENCRYPTED]' AND NEW.address != '' THEN
    NEW.address_encrypted := encode(extensions.pgp_sym_encrypt(NEW.address::text, v_key), 'base64');
  END IF;

  RETURN NEW;
END;
$$;

-- Create decryption function for profile contact info
CREATE OR REPLACE FUNCTION decrypt_profile_contact(p_encrypted_data text, p_field_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'profile_contact', 'UTF8'), 'sha256'), 'hex');
  RETURN extensions.pgp_sym_decrypt(decode(p_encrypted_data, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- Create trigger for automatic encryption
DROP TRIGGER IF EXISTS encrypt_profile_contact_trigger ON profiles;
CREATE TRIGGER encrypt_profile_contact_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_profile_contact();

-- Backfill existing profile contact information
UPDATE profiles
SET 
  email_encrypted = encode(extensions.pgp_sym_encrypt(
    email::text, 
    encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'profile_contact', 'UTF8'), 'sha256'), 'hex')
  ), 'base64')
WHERE email IS NOT NULL 
  AND email != '[ENCRYPTED]'
  AND email != ''
  AND email_encrypted IS NULL;

UPDATE profiles
SET 
  phone_encrypted = encode(extensions.pgp_sym_encrypt(
    phone::text, 
    encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'profile_contact', 'UTF8'), 'sha256'), 'hex')
  ), 'base64')
WHERE phone IS NOT NULL 
  AND phone != '[ENCRYPTED]'
  AND phone != ''
  AND phone_encrypted IS NULL;

UPDATE profiles
SET 
  address_encrypted = encode(extensions.pgp_sym_encrypt(
    address::text, 
    encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'profile_contact', 'UTF8'), 'sha256'), 'hex')
  ), 'base64')
WHERE address IS NOT NULL 
  AND address != '[ENCRYPTED]'
  AND address != ''
  AND address_encrypted IS NULL;

-- ============================================================================
-- PRIORITY 4: PATIENT PHI ACCESS LOGGING FUNCTION
-- ============================================================================

-- Create RPC function for logging patient PHI access from frontend
CREATE OR REPLACE FUNCTION log_patient_phi_access(
  p_patient_id uuid,
  p_patient_name text,
  p_accessed_fields jsonb,
  p_viewer_role text,
  p_relationship text,
  p_component_context text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_audit_id uuid;
  v_accessed_field_list text[];
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  -- Build list of accessed fields
  v_accessed_field_list := ARRAY[]::text[];
  IF (p_accessed_fields->>'allergies')::boolean THEN
    v_accessed_field_list := array_append(v_accessed_field_list, 'allergies');
  END IF;
  IF (p_accessed_fields->>'notes')::boolean THEN
    v_accessed_field_list := array_append(v_accessed_field_list, 'notes');
  END IF;
  IF (p_accessed_fields->>'address')::boolean THEN
    v_accessed_field_list := array_append(v_accessed_field_list, 'address');
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    user_email,
    user_role,
    action_type,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    v_user_id,
    v_user_email,
    p_viewer_role,
    'patient_phi_accessed',
    'patients',
    p_patient_id,
    jsonb_build_object(
      'patient_name', p_patient_name,
      'accessed_fields', v_accessed_field_list,
      'relationship', p_relationship,
      'component_context', p_component_context,
      'timestamp', now()
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;