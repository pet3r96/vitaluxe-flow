-- Create internal schema for non-API objects
CREATE SCHEMA IF NOT EXISTS internal;

-- Move security_events_summary to internal schema
DROP MATERIALIZED VIEW IF EXISTS public.security_events_summary;

CREATE MATERIALIZED VIEW internal.security_events_summary AS
SELECT 
  action_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_occurrence
FROM public.audit_logs
WHERE action_type IN (
  'prescription_accessed',
  'patient_accessed',
  'cart_phi_accessed',
  'INSERT_payment_method',
  'UPDATE_payment_method',
  'concurrent_session_detected'
)
GROUP BY action_type;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_security_events_summary_action 
ON internal.security_events_summary(action_type);

-- Create secure function to access the materialized view
CREATE OR REPLACE FUNCTION public.get_security_events_summary()
RETURNS TABLE(
  action_type text,
  event_count bigint,
  unique_users bigint,
  last_occurrence timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can access
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    s.action_type,
    s.event_count,
    s.unique_users,
    s.last_occurrence
  FROM internal.security_events_summary s;
END;
$$;

-- Update the refresh function to point to new location
CREATE OR REPLACE FUNCTION public.refresh_security_events_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.security_events_summary;
END;
$$;