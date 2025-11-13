-- ============================================================================
-- SUPER ADMIN IMPERSONATION: Phase 1B - Assign Role & Update Policies
-- ============================================================================

-- Step 1: Assign super_admin role to info@vitaluxeservices.com
DO $$
DECLARE
  super_admin_user_id uuid;
BEGIN
  -- Get the user ID for info@vitaluxeservices.com
  SELECT id INTO super_admin_user_id
  FROM auth.users
  WHERE email = 'info@vitaluxeservices.com';
  
  IF super_admin_user_id IS NOT NULL THEN
    -- Insert super_admin role (will skip if already exists due to unique constraint)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (super_admin_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Assigned super_admin role to info@vitaluxeservices.com';
  ELSE
    RAISE NOTICE 'User info@vitaluxeservices.com not found';
  END IF;
END $$;

-- Step 2: Create security definer function to check super_admin status
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = 'super_admin'
  );
$$;

-- Step 3: Update RLS policy on active_impersonation_sessions to only allow super_admin
DROP POLICY IF EXISTS "Only admins can start impersonation" ON public.active_impersonation_sessions;

CREATE POLICY "Only super_admins can start impersonation"
ON public.active_impersonation_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can view their impersonation sessions" ON public.active_impersonation_sessions;

CREATE POLICY "Only super_admins can view their impersonation sessions"
ON public.active_impersonation_sessions
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()) AND admin_user_id = auth.uid());

DROP POLICY IF EXISTS "Only admins can end their impersonation" ON public.active_impersonation_sessions;

CREATE POLICY "Only super_admins can end their impersonation"
ON public.active_impersonation_sessions
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()) AND admin_user_id = auth.uid());

-- Step 4: Create audit log for super_admin impersonation starts
CREATE OR REPLACE FUNCTION public.log_impersonation_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    user_role,
    action_type,
    entity_type,
    entity_id,
    details
  )
  SELECT
    NEW.admin_user_id,
    u.email,
    'super_admin',
    'impersonation_started',
    'user',
    NEW.target_user_id,
    jsonb_build_object(
      'target_user_id', NEW.target_user_id,
      'target_user_email', tu.email,
      'reason', NEW.reason,
      'session_id', NEW.id,
      'timestamp', NOW()
    )
  FROM auth.users u
  LEFT JOIN auth.users tu ON tu.id = NEW.target_user_id
  WHERE u.id = NEW.admin_user_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_impersonation_start ON public.active_impersonation_sessions;
CREATE TRIGGER trigger_log_impersonation_start
  AFTER INSERT ON public.active_impersonation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_impersonation_start();

-- Step 5: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_impersonation_start() TO authenticated;