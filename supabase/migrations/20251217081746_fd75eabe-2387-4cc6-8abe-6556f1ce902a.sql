-- Grant execute to service_role so edge functions can use it
GRANT EXECUTE ON FUNCTION public.decrypt_pharmacy_credentials_batch(UUID) TO service_role;