-- Add helper function to get auth user ID by email
-- This avoids the problematic listUsers() call
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER(p_email) LIMIT 1
$$;