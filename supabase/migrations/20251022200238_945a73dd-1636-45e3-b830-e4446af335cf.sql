-- Fix search_path for cleanup_expired_sms_codes function
DROP FUNCTION IF EXISTS cleanup_expired_sms_codes();

CREATE OR REPLACE FUNCTION cleanup_expired_sms_codes()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM sms_codes 
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;