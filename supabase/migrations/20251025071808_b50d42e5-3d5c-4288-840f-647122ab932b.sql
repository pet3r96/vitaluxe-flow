
-- Fix any functions missing search_path (addresses SUPA_function_search_path_mutable)
-- Update all SECURITY DEFINER functions to explicitly set search_path

DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname as schema, p.proname as function_name, p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND prosecdef = true
          AND pg_get_functiondef(p.oid) NOT LIKE '%search_path%'
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I SET search_path = public', 
                      func_record.schema, 
                      func_record.function_name);
        RAISE NOTICE 'Updated search_path for function: %.%', func_record.schema, func_record.function_name;
    END LOOP;
END $$;

-- Create server-side impersonation sessions table (replaces client-side sessionStorage)
-- This addresses CLIENT_SIDE_AUTH security finding by moving impersonation state to the database

CREATE TABLE IF NOT EXISTS public.active_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  impersonated_role text NOT NULL,
  impersonated_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  impersonated_user_name text,
  impersonation_log_id uuid REFERENCES public.impersonation_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '8 hours'),
  last_activity timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT active_session_per_admin UNIQUE (admin_user_id)
);

-- Enable RLS on the new table
ALTER TABLE public.active_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins with impersonation permissions can manage their own sessions
CREATE POLICY "Admins can manage their own impersonation sessions"
ON public.active_impersonation_sessions
FOR ALL
TO authenticated
USING (
  admin_user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.impersonation_permissions 
    WHERE user_id = auth.uid() 
      AND can_impersonate = true 
      AND revoked_at IS NULL
  )
)
WITH CHECK (
  admin_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.impersonation_permissions 
    WHERE user_id = auth.uid() 
      AND can_impersonate = true 
      AND revoked_at IS NULL
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_active_impersonation_admin_user 
ON public.active_impersonation_sessions(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_active_impersonation_expires 
ON public.active_impersonation_sessions(expires_at);

-- Function to cleanup expired sessions (called by scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_impersonation_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired sessions
  WITH deleted AS (
    DELETE FROM active_impersonation_sessions
    WHERE expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE public.active_impersonation_sessions IS 
'Server-side storage for active admin impersonation sessions. Replaces client-side sessionStorage to prevent tampering. Sessions expire after 8 hours or on inactivity.';

COMMENT ON FUNCTION public.cleanup_expired_impersonation_sessions() IS
'Removes expired impersonation sessions. Should be called by a scheduled job every hour.';
