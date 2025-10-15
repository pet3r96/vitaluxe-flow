-- ============================================================================
-- Fix Payment Method Encryption
-- ============================================================================

-- Drop the incorrectly created triggers
DROP TRIGGER IF EXISTS encrypt_payment_before_insert ON public.practice_payment_methods;
DROP TRIGGER IF EXISTS encrypt_payment_before_update ON public.practice_payment_methods;

-- Create proper encryption trigger function for payment methods
CREATE OR REPLACE FUNCTION public.encrypt_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Encrypt Plaid access token if present
  IF NEW.plaid_access_token IS NOT NULL AND NEW.plaid_access_token != '' THEN
    NEW.plaid_access_token_encrypted := encrypt_plaid_token(NEW.plaid_access_token);
    -- Don't clear the original token yet to maintain compatibility
    -- This should be done after verifying all queries use encrypted version
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach encryption triggers to practice_payment_methods
CREATE TRIGGER encrypt_payment_method_before_insert
  BEFORE INSERT ON public.practice_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_payment_method();

CREATE TRIGGER encrypt_payment_method_before_update
  BEFORE UPDATE ON public.practice_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_payment_method();

-- Note: The log_payment_method_access trigger already exists and will continue to work