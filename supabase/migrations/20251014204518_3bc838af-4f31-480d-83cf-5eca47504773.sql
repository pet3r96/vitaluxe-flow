-- Fix update_updated_at_column function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create user_sessions table for CSRF protection
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, csrf_token)
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own sessions
CREATE POLICY "Users can manage own sessions"
ON public.user_sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create active_sessions table for session management
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on active_sessions
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view own sessions"
ON public.active_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: System can insert sessions
CREATE POLICY "System can insert sessions"
ON public.active_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update own sessions"
ON public.active_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON public.active_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for concurrent session detection
CREATE OR REPLACE FUNCTION public.detect_concurrent_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_sessions_count INTEGER;
  different_ips_count INTEGER;
BEGIN
  -- Count recent sessions from different IPs in last 5 minutes
  SELECT COUNT(DISTINCT ip_address) INTO different_ips_count
  FROM public.active_sessions
  WHERE user_id = NEW.user_id
    AND last_activity > now() - INTERVAL '5 minutes'
    AND ip_address IS NOT NULL
    AND ip_address != NEW.ip_address;
  
  -- Log security event if multiple IPs detected
  IF different_ips_count > 0 THEN
    PERFORM log_audit_event(
      'concurrent_session_detected',
      'active_sessions',
      NEW.id,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'new_ip', NEW.ip_address,
        'different_ips_count', different_ips_count
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_detect_concurrent_sessions ON public.active_sessions;
CREATE TRIGGER trigger_detect_concurrent_sessions
  AFTER INSERT ON public.active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_concurrent_sessions();

-- Add update triggers for timestamps
DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON public.user_sessions;
CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_active_sessions_updated_at ON public.active_sessions;
CREATE TRIGGER update_active_sessions_updated_at
  BEFORE UPDATE ON public.active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();