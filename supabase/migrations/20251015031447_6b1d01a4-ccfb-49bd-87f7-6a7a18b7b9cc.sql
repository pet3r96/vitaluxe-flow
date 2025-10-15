-- Phase 1: Add Encryption Infrastructure
ALTER TABLE public.cart_lines
ADD COLUMN IF NOT EXISTS prescription_url_encrypted text,
ADD COLUMN IF NOT EXISTS custom_dosage_encrypted text,
ADD COLUMN IF NOT EXISTS custom_sig_encrypted text,
ADD COLUMN IF NOT EXISTS patient_address_encrypted text,
ADD COLUMN IF NOT EXISTS patient_email_encrypted text,
ADD COLUMN IF NOT EXISTS patient_phone_encrypted text;

-- Create Encryption Trigger Function
CREATE OR REPLACE FUNCTION public.encrypt_cart_line_phi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'cart_phi', 'sha256'), 'hex');
  
  -- Encrypt prescription URL
  IF NEW.prescription_url IS NOT NULL AND NEW.prescription_url != '' THEN
    NEW.prescription_url_encrypted := encode(pgp_sym_encrypt(NEW.prescription_url, v_key), 'base64');
  END IF;
  
  -- Encrypt patient contact info
  IF NEW.patient_email IS NOT NULL THEN
    NEW.patient_email_encrypted := encode(pgp_sym_encrypt(NEW.patient_email, v_key), 'base64');
  END IF;
  
  IF NEW.patient_phone IS NOT NULL THEN
    NEW.patient_phone_encrypted := encode(pgp_sym_encrypt(NEW.patient_phone, v_key), 'base64');
  END IF;
  
  IF NEW.patient_address IS NOT NULL THEN
    NEW.patient_address_encrypted := encode(pgp_sym_encrypt(NEW.patient_address, v_key), 'base64');
  END IF;
  
  -- Encrypt custom dosage/sig
  IF NEW.custom_dosage IS NOT NULL THEN
    NEW.custom_dosage_encrypted := encode(pgp_sym_encrypt(NEW.custom_dosage, v_key), 'base64');
  END IF;
  
  IF NEW.custom_sig IS NOT NULL THEN
    NEW.custom_sig_encrypted := encode(pgp_sym_encrypt(NEW.custom_sig, v_key), 'base64');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create Decryption Function
CREATE OR REPLACE FUNCTION public.decrypt_cart_phi(
  p_encrypted_data text,
  p_field_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := encode(digest(current_setting('app.encryption_secret', true) || 'cart_phi', 'sha256'), 'hex');
  RETURN pgp_sym_decrypt(decode(p_encrypted_data, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- Phase 2: Implement Audit Logging
CREATE OR REPLACE FUNCTION public.log_cart_line_phi_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log when cart lines with PHI are accessed
  IF NEW.prescription_url IS NOT NULL 
     OR NEW.patient_email IS NOT NULL 
     OR NEW.patient_phone IS NOT NULL 
     OR NEW.patient_address IS NOT NULL THEN
    
    PERFORM log_audit_event(
      'cart_phi_accessed',
      'cart_lines',
      NEW.id,
      jsonb_build_object(
        'patient_name', NEW.patient_name,
        'has_prescription', NEW.prescription_url IS NOT NULL,
        'has_contact_info', (NEW.patient_email IS NOT NULL OR NEW.patient_phone IS NOT NULL),
        'has_address', NEW.patient_address IS NOT NULL,
        'cart_id', NEW.cart_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for audit logging
CREATE TRIGGER trg_log_cart_phi_access
AFTER INSERT OR UPDATE ON public.cart_lines
FOR EACH ROW
EXECUTE FUNCTION public.log_cart_line_phi_access();

-- Phase 3: Implement Time-Based Access Control
ALTER TABLE public.cart_lines
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + interval '7 days');

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_cart_lines_expires_at ON public.cart_lines(expires_at);

-- Create Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_expired_cart_lines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete expired cart lines
  WITH deleted AS (
    DELETE FROM public.cart_lines
    WHERE expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Phase 3: Update RLS with Time Restriction
DROP POLICY IF EXISTS "Doctors can view their own cart lines" ON public.cart_lines;

CREATE POLICY "Doctors can view non-expired cart lines"
ON public.cart_lines
FOR SELECT
USING (
  is_cart_owner(auth.uid(), cart_id) 
  AND (expires_at IS NULL OR expires_at > now())
);

-- Phase 4: Add Provider-Specific Access Control
CREATE POLICY "Providers can only view their assigned cart lines"
ON public.cart_lines
FOR SELECT
USING (
  provider_id = auth.uid()
  AND (expires_at IS NULL OR expires_at > now())
);

-- Phase 4: Create Masking View
CREATE OR REPLACE VIEW public.cart_lines_masked AS
SELECT 
  id,
  cart_id,
  product_id,
  provider_id,
  patient_id,
  patient_name,
  CASE 
    WHEN patient_email IS NOT NULL THEN 
      substring(patient_email, 1, 1) || '***@' || 
      substring(patient_email, position('@' IN patient_email) + 1)
    ELSE NULL
  END as patient_email_masked,
  CASE 
    WHEN patient_phone IS NOT NULL THEN 
      '(' || substring(patient_phone, 1, 3) || ') ***-' || 
      substring(patient_phone, length(patient_phone) - 3)
    ELSE NULL
  END as patient_phone_masked,
  CASE 
    WHEN patient_address IS NOT NULL THEN 
      regexp_replace(patient_address, '^.*,\s*([^,]+,\s*[A-Z]{2}\s+\d{5}).*$', '*****, \1')
    ELSE NULL
  END as patient_address_masked,
  CASE WHEN prescription_url IS NOT NULL THEN '[REDACTED]' ELSE NULL END as prescription_url_indicator,
  quantity,
  price_snapshot,
  destination_state,
  order_notes,
  prescription_method,
  refills_allowed,
  refills_total,
  refills_remaining,
  created_at,
  expires_at
FROM public.cart_lines;

GRANT SELECT ON public.cart_lines_masked TO authenticated;

-- Phase 7: Rate Limiting Infrastructure
CREATE TABLE IF NOT EXISTS public.cart_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  cart_id uuid REFERENCES public.cart(id),
  access_count integer DEFAULT 1,
  last_access_at timestamp with time zone DEFAULT now(),
  window_start timestamp with time zone DEFAULT now(),
  ip_address text
);

CREATE INDEX IF NOT EXISTS idx_cart_access_log_user_window ON public.cart_access_log(user_id, window_start);

ALTER TABLE public.cart_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cart access logs"
ON public.cart_access_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage cart access logs"
ON public.cart_access_log
FOR ALL
USING (true)
WITH CHECK (true);