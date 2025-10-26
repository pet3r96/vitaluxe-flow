-- Fix security warnings for rep_productivity_summary
-- 1. Revoke public access to materialized view (only accessible via the view wrapper)
REVOKE ALL ON public.rep_productivity_summary FROM PUBLIC;
REVOKE ALL ON public.rep_productivity_summary FROM authenticated;
REVOKE ALL ON public.rep_productivity_summary FROM anon;

-- 2. Ensure the view uses security_invoker (queries run with caller's permissions)
ALTER VIEW public.rep_productivity_view SET (security_invoker = on);

-- 3. Only the view should be accessible to authenticated users
GRANT SELECT ON public.rep_productivity_view TO authenticated;