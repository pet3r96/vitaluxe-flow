-- Update can_user_impersonate function to handle missing permission rows gracefully
-- This ensures admins can impersonate by default even if their row is missing
CREATE OR REPLACE FUNCTION public.can_user_impersonate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Admin users can impersonate if:
  -- 1. They have admin role AND
  -- 2. Either no explicit permission entry exists (default allow) OR permission is granted
  SELECT 
    has_role(_user_id, 'admin'::app_role) 
    AND 
    COALESCE(
      (SELECT can_impersonate 
       FROM public.impersonation_permissions 
       WHERE user_id = _user_id 
         AND revoked_at IS NULL 
       LIMIT 1),
      true  -- Default to true if no row exists
    )
$function$;