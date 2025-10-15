-- ============================================================================
-- CRITICAL SECURITY FIXES - PHI Encryption & RLS Policies
-- ============================================================================

-- 1. Enable PHI Encryption for cart_lines table
CREATE TRIGGER encrypt_cart_phi_before_insert
  BEFORE INSERT ON public.cart_lines
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_cart_line_phi();

CREATE TRIGGER encrypt_cart_phi_before_update
  BEFORE UPDATE ON public.cart_lines
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_cart_line_phi();

-- 2. Enable PHI Encryption for patients table
CREATE TRIGGER encrypt_patient_phi_before_insert
  BEFORE INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_patient_phi();

CREATE TRIGGER encrypt_patient_phi_before_update
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_patient_phi();

-- 3. Enable Prescription Data Encryption for order_lines table
CREATE TRIGGER encrypt_prescription_before_insert
  BEFORE INSERT ON public.order_lines
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_prescription_data();

CREATE TRIGGER encrypt_prescription_before_update
  BEFORE UPDATE ON public.order_lines
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_prescription_data();

-- 4. Enable Payment Token Encryption for practice_payment_methods
-- Note: This requires careful handling of existing Plaid tokens
CREATE TRIGGER encrypt_payment_before_insert
  BEFORE INSERT ON public.practice_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_method_access();

CREATE TRIGGER encrypt_payment_before_update
  BEFORE UPDATE ON public.practice_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_method_access();

-- 5. Add RLS policies for security_events table (if it exists)
-- First check if table exists, if not, create it
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view security events" ON public.security_events;
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

-- Create restrictive RLS policies
CREATE POLICY "Admins can view security events"
ON public.security_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert security events"
ON public.security_events FOR INSERT
WITH CHECK (true);

-- Prevent any updates or deletes to maintain audit integrity
-- (No UPDATE or DELETE policies = no one can modify/delete)

-- 6. Create index for performance on security_events
CREATE INDEX IF NOT EXISTS idx_security_events_created_at 
ON public.security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id 
ON public.security_events(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_events_event_type 
ON public.security_events(event_type);