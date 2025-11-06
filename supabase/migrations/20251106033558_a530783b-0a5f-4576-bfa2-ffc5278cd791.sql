-- Fix security issues identified in scan

-- 1. Move pg_net extension from public to extensions schema
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Move materialized view from public API by revoking access
-- Keep the view for internal use but restrict API access
REVOKE ALL ON TABLE public.rep_productivity_summary FROM anon, authenticated;

-- Grant only to service_role for internal/admin use
GRANT SELECT ON TABLE public.rep_productivity_summary TO service_role;