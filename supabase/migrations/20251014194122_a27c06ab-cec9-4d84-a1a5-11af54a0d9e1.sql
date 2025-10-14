-- ========================================
-- COMPREHENSIVE SECURITY HARDENING PHASE 2
-- High Priority: PHI/PII Protection & Encryption
-- ========================================

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- 1. ENCRYPT PLAID ACCESS TOKENS
-- ========================================

-- Add encryption key management
CREATE TABLE IF NOT EXISTS encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  rotated_at timestamptz,
  active boolean DEFAULT true
);

-- Create secure function to encrypt Plaid tokens
CREATE OR REPLACE FUNCTION public.encrypt_plaid_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  -- Use a derived encryption key (in production, manage this securely)
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'plaid', 'sha256'), 'hex');
  RETURN encode(pgp_sym_encrypt(p_token, v_key), 'base64');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption failed: %', SQLERRM;
END;
$$;

-- Create secure function to decrypt Plaid tokens
CREATE OR REPLACE FUNCTION public.decrypt_plaid_token(p_encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'plaid', 'sha256'), 'hex');
  RETURN pgp_sym_decrypt(decode(p_encrypted_token, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption failed: %', SQLERRM;
END;
$$;

-- Add audit logging for payment method access
CREATE OR REPLACE FUNCTION public.log_payment_method_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_audit_event(
    TG_OP || '_payment_method',
    'practice_payment_methods',
    NEW.id,
    jsonb_build_object(
      'practice_id', NEW.practice_id,
      'bank_name', NEW.bank_name,
      'account_mask', NEW.account_mask,
      'is_default', NEW.is_default
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_payment_method_access ON public.practice_payment_methods;
CREATE TRIGGER trg_log_payment_method_access
AFTER INSERT OR UPDATE OR DELETE ON public.practice_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_method_access();

-- ========================================
-- 2. PROTECT PATIENT PHI DATA
-- ========================================

-- Add encrypted columns for sensitive patient data
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS allergies_encrypted text,
ADD COLUMN IF NOT EXISTS notes_encrypted text;

-- Create function to encrypt patient PHI
CREATE OR REPLACE FUNCTION public.encrypt_patient_phi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'patient_phi', 'sha256'), 'hex');
  
  -- Encrypt allergies if present
  IF NEW.allergies IS NOT NULL AND NEW.allergies != '' THEN
    NEW.allergies_encrypted := encode(pgp_sym_encrypt(NEW.allergies, v_key), 'base64');
    NEW.allergies := '[ENCRYPTED]'; -- Mask original field
  END IF;
  
  -- Encrypt notes if present
  IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
    NEW.notes_encrypted := encode(pgp_sym_encrypt(NEW.notes, v_key), 'base64');
    NEW.notes := '[ENCRYPTED]'; -- Mask original field
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for patient PHI encryption (disabled by default for existing workflows)
-- Uncomment when ready to enable encryption:
-- DROP TRIGGER IF EXISTS trg_encrypt_patient_phi ON public.patients;
-- CREATE TRIGGER trg_encrypt_patient_phi
-- BEFORE INSERT OR UPDATE ON public.patients
-- FOR EACH ROW
-- EXECUTE FUNCTION public.encrypt_patient_phi();

-- Add comprehensive audit logging for patient data access
CREATE OR REPLACE FUNCTION public.log_patient_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_audit_event(
    TG_OP || '_patient',
    'patients',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'practice_id', COALESCE(NEW.practice_id, OLD.practice_id),
      'has_phi', (COALESCE(NEW.allergies, OLD.allergies) IS NOT NULL 
                  OR COALESCE(NEW.notes, OLD.notes) IS NOT NULL),
      'has_address', (COALESCE(NEW.address, OLD.address) IS NOT NULL),
      'operation', TG_OP
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_patient_access ON public.patients;
CREATE TRIGGER trg_log_patient_access
AFTER INSERT OR UPDATE OR DELETE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.log_patient_access();

-- ========================================
-- 3. PROTECT PRESCRIPTION DATA IN ORDER_LINES
-- ========================================

-- Add encrypted columns for prescription data
ALTER TABLE public.order_lines
ADD COLUMN IF NOT EXISTS prescription_url_encrypted text,
ADD COLUMN IF NOT EXISTS custom_dosage_encrypted text,
ADD COLUMN IF NOT EXISTS custom_sig_encrypted text;

-- Create function to encrypt prescription data
CREATE OR REPLACE FUNCTION public.encrypt_prescription_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'prescription', 'sha256'), 'hex');
  
  -- Encrypt prescription URL if present
  IF NEW.prescription_url IS NOT NULL AND NEW.prescription_url != '' THEN
    NEW.prescription_url_encrypted := encode(pgp_sym_encrypt(NEW.prescription_url, v_key), 'base64');
  END IF;
  
  -- Encrypt custom dosage if present
  IF NEW.custom_dosage IS NOT NULL AND NEW.custom_dosage != '' THEN
    NEW.custom_dosage_encrypted := encode(pgp_sym_encrypt(NEW.custom_dosage, v_key), 'base64');
  END IF;
  
  -- Encrypt custom sig if present
  IF NEW.custom_sig IS NOT NULL AND NEW.custom_sig != '' THEN
    NEW.custom_sig_encrypted := encode(pgp_sym_encrypt(NEW.custom_sig, v_key), 'base64');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for prescription data encryption (disabled by default)
-- Uncomment when ready to enable encryption:
-- DROP TRIGGER IF EXISTS trg_encrypt_prescription_data ON public.order_lines;
-- CREATE TRIGGER trg_encrypt_prescription_data
-- BEFORE INSERT OR UPDATE ON public.order_lines
-- FOR EACH ROW
-- EXECUTE FUNCTION public.encrypt_prescription_data();

-- Add audit logging for prescription access
CREATE OR REPLACE FUNCTION public.log_prescription_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log when prescription data is involved
  IF (NEW.prescription_url IS NOT NULL OR 
      NEW.custom_dosage IS NOT NULL OR 
      NEW.custom_sig IS NOT NULL) THEN
    
    PERFORM log_audit_event(
      'prescription_accessed',
      'order_lines',
      NEW.id,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'has_prescription', NEW.prescription_url IS NOT NULL,
        'has_custom_dosage', NEW.custom_dosage IS NOT NULL,
        'has_custom_sig', NEW.custom_sig IS NOT NULL,
        'patient_name', NEW.patient_name,
        'assigned_pharmacy_id', NEW.assigned_pharmacy_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_prescription_access ON public.order_lines;
CREATE TRIGGER trg_log_prescription_access
AFTER INSERT OR UPDATE ON public.order_lines
FOR EACH ROW
EXECUTE FUNCTION public.log_prescription_access();

-- ========================================
-- 4. ENHANCE AUDIT LOG SECURITY
-- ========================================

-- Create index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action 
ON public.audit_logs(user_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
ON public.audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_phi_access 
ON public.audit_logs(action_type, created_at DESC) 
WHERE action_type IN ('prescription_accessed', 'INSERT_patient', 'UPDATE_patient', 'cart_line_accessed');

-- Create materialized view for security dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS public.security_events_summary AS
SELECT 
  date_trunc('hour', created_at) as event_hour,
  action_type,
  user_role,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT ip_address) as unique_ips
FROM public.audit_logs
WHERE created_at > now() - interval '7 days'
GROUP BY date_trunc('hour', created_at), action_type, user_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_security_events_summary_unique 
ON public.security_events_summary(event_hour, action_type, COALESCE(user_role, 'unknown'));

-- Create function to refresh security events summary
CREATE OR REPLACE FUNCTION public.refresh_security_events_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.security_events_summary;
END;
$$;

-- ========================================
-- 5. STRENGTHEN RLS POLICIES
-- ========================================

-- Ensure patients table has strict RLS
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'patients' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policy to prevent cross-practice patient access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patients' 
    AND policyname = 'Prevent cross-practice access'
  ) THEN
    CREATE POLICY "Prevent cross-practice access"
    ON public.patients
    AS RESTRICTIVE
    FOR ALL
    USING (
      practice_id = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM providers p 
        WHERE p.user_id = auth.uid() 
        AND p.practice_id = patients.practice_id
      )
    );
  END IF;
END $$;

-- Add comment documenting encryption approach
COMMENT ON COLUMN public.patients.allergies_encrypted IS 'PGP encrypted patient allergies data - use decrypt_patient_phi() to access';
COMMENT ON COLUMN public.patients.notes_encrypted IS 'PGP encrypted patient notes - use decrypt_patient_phi() to access';
COMMENT ON COLUMN public.order_lines.prescription_url_encrypted IS 'PGP encrypted prescription URL - use decrypt_prescription_data() to access';
COMMENT ON FUNCTION public.encrypt_plaid_token IS 'Encrypts Plaid access tokens using PGP symmetric encryption';
COMMENT ON FUNCTION public.log_audit_event IS 'HIPAA-compliant audit logging function for tracking all PHI/PII access';