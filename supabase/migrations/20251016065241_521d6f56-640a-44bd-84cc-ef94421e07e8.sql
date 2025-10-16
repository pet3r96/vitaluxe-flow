-- Fix get_client_ip() function to set search_path
CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try x-real-ip header first (common in proxies)
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-real-ip',
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  );
END;
$$;