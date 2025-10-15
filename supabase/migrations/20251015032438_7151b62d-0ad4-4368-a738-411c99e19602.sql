-- Fix RLS policy on statuses table to require authentication
DROP POLICY IF EXISTS "Authenticated users can view active statuses" ON public.statuses;

CREATE POLICY "Authenticated users can view active statuses"
ON public.statuses FOR SELECT
USING (
  auth.uid() IS NOT NULL  -- Require authentication
  AND active = true
);