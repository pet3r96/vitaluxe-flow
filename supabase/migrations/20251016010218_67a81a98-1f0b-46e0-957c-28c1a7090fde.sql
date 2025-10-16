-- Phase 1: Critical Security Fixes
-- 1.1 Fix Payment Token Encryption
ALTER TABLE practice_payment_methods 
ADD COLUMN IF NOT EXISTS plaid_access_token_encrypted TEXT;

-- Backfill existing Plaid tokens (encrypt plaintext tokens)
DO $$
DECLARE
  v_key text;
  payment_record RECORD;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'plaid', 'UTF8'), 'sha256'), 'hex');
  
  FOR payment_record IN 
    SELECT id, plaid_access_token 
    FROM practice_payment_methods 
    WHERE plaid_access_token IS NOT NULL 
      AND plaid_access_token != ''
      AND plaid_access_token_encrypted IS NULL
  LOOP
    UPDATE practice_payment_methods
    SET plaid_access_token_encrypted = encode(extensions.pgp_sym_encrypt(payment_record.plaid_access_token::text, v_key), 'base64')
    WHERE id = payment_record.id;
  END LOOP;
END $$;

-- 1.2 Backfill Cart Lines Encryption
DO $$
DECLARE
  v_key text;
  cart_record RECORD;
BEGIN
  v_key := encode(extensions.digest(convert_to(coalesce(current_setting('app.encryption_secret', true), '') || 'cart_phi', 'UTF8'), 'sha256'), 'hex');
  
  FOR cart_record IN 
    SELECT id, patient_email, patient_phone, patient_address, prescription_url, custom_dosage, custom_sig
    FROM cart_lines 
    WHERE (patient_email IS NOT NULL AND patient_email_encrypted IS NULL)
       OR (patient_phone IS NOT NULL AND patient_phone_encrypted IS NULL)
       OR (patient_address IS NOT NULL AND patient_address_encrypted IS NULL)
       OR (prescription_url IS NOT NULL AND prescription_url_encrypted IS NULL)
       OR (custom_dosage IS NOT NULL AND custom_dosage_encrypted IS NULL)
       OR (custom_sig IS NOT NULL AND custom_sig_encrypted IS NULL)
  LOOP
    UPDATE cart_lines
    SET 
      patient_email_encrypted = CASE WHEN cart_record.patient_email IS NOT NULL THEN encode(extensions.pgp_sym_encrypt(cart_record.patient_email::text, v_key), 'base64') ELSE NULL END,
      patient_phone_encrypted = CASE WHEN cart_record.patient_phone IS NOT NULL THEN encode(extensions.pgp_sym_encrypt(cart_record.patient_phone::text, v_key), 'base64') ELSE NULL END,
      patient_address_encrypted = CASE WHEN cart_record.patient_address IS NOT NULL THEN encode(extensions.pgp_sym_encrypt(cart_record.patient_address::text, v_key), 'base64') ELSE NULL END,
      prescription_url_encrypted = CASE WHEN cart_record.prescription_url IS NOT NULL THEN encode(extensions.pgp_sym_encrypt(cart_record.prescription_url::text, v_key), 'base64') ELSE NULL END,
      custom_dosage_encrypted = CASE WHEN cart_record.custom_dosage IS NOT NULL THEN encode(extensions.pgp_sym_encrypt(cart_record.custom_dosage::text, v_key), 'base64') ELSE NULL END,
      custom_sig_encrypted = CASE WHEN cart_record.custom_sig IS NOT NULL THEN encode(extensions.pgp_sym_encrypt(cart_record.custom_sig::text, v_key), 'base64') ELSE NULL END,
      patient_email = CASE WHEN cart_record.patient_email IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END,
      patient_phone = CASE WHEN cart_record.patient_phone IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END,
      patient_address = CASE WHEN cart_record.patient_address IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END
    WHERE id = cart_record.id;
  END LOOP;
END $$;

-- Phase 2: File Upload Security Infrastructure
-- Create file upload audit log table
CREATE TABLE IF NOT EXISTS file_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('passed', 'failed', 'quarantined')),
  virus_scan_status TEXT CHECK (virus_scan_status IN ('clean', 'infected', 'error', 'skipped')),
  validation_errors JSONB DEFAULT '[]'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on file upload logs
ALTER TABLE file_upload_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all upload logs
CREATE POLICY "Admins can view all upload logs"
  ON file_upload_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert upload logs
CREATE POLICY "System can insert upload logs"
  ON file_upload_logs FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_user_id ON file_upload_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_created_at ON file_upload_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_validation_status ON file_upload_logs(validation_status);
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_virus_scan_status ON file_upload_logs(virus_scan_status);

-- Create quarantine bucket for infected files
INSERT INTO storage.buckets (id, name, public)
VALUES ('quarantine', 'quarantine', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can access quarantine bucket
CREATE POLICY "Only admins can view quarantined files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quarantine' AND has_role(auth.uid(), 'admin'::app_role));

-- Log backfill completion
INSERT INTO audit_logs (action_type, entity_type, details)
VALUES (
  'security_backfill_complete',
  'system',
  jsonb_build_object(
    'payment_tokens_encrypted', true,
    'cart_lines_encrypted', true,
    'file_upload_infrastructure', true,
    'timestamp', now()
  )
);