-- ============================================================================
-- Update can_user_impersonate to check for super_admin role only
-- ============================================================================

-- Drop and recreate the can_user_impersonate function to check for super_admin
DROP FUNCTION IF EXISTS public.can_user_impersonate(uuid);

CREATE OR REPLACE FUNCTION public.can_user_impersonate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  );
$$;

COMMENT ON FUNCTION public.can_user_impersonate(uuid) IS 'Check if user has super_admin role and can impersonate other users';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_user_impersonate(uuid) TO authenticated;