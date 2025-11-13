-- Fix audit trigger to match active_impersonation_sessions schema
-- Use impersonated_user_id instead of target_user_id; remove reason field

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
    NEW.impersonated_user_id,
    jsonb_build_object(
      'impersonated_user_id', NEW.impersonated_user_id,
      'impersonated_user_name', NEW.impersonated_user_name,
      'impersonated_role', NEW.impersonated_role,
      'session_id', NEW.id,
      'timestamp', NOW()
    )
  FROM auth.users u
  WHERE u.id = NEW.admin_user_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_impersonation_start ON public.active_impersonation_sessions;
CREATE TRIGGER trigger_log_impersonation_start
  AFTER INSERT ON public.active_impersonation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_impersonation_start();

-- Ensure execute permissions
GRANT EXECUTE ON FUNCTION public.log_impersonation_start() TO authenticated;