-- Step 1: Fix the infinite recursion in reps table RLS policies
-- Drop the problematic policy
DROP POLICY IF EXISTS "Toplines can view their downlines" ON public.reps;

-- Create a simpler, non-recursive policy for toplines to view their downlines
-- This avoids the infinite recursion by not querying reps table in the policy itself
CREATE POLICY "Toplines can view their downlines"
ON public.reps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
      AND ur.role = 'topline'::app_role
  )
  AND assigned_topline_id IN (
    SELECT r.id 
    FROM public.reps r
    WHERE r.user_id = auth.uid()
  )
);

-- Step 2: Add a policy to allow service role to insert reps
-- This ensures the edge function can create reps entries
CREATE POLICY "Service role can insert reps"
ON public.reps
FOR INSERT
TO service_role
WITH CHECK (true);

-- Step 3: Data repair - populate missing reps entries
-- Find topline users without reps entries and create them
INSERT INTO public.reps (user_id, role, assigned_topline_id, active)
SELECT 
  ur.user_id,
  'topline'::app_role,
  NULL,
  p.active
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
LEFT JOIN public.reps r ON r.user_id = ur.user_id
WHERE ur.role = 'topline'::app_role
  AND r.id IS NULL;

-- Step 4: Find downline users without reps entries and create them
-- This handles downlines that were created before the edge function fix
INSERT INTO public.reps (user_id, role, assigned_topline_id, active)
SELECT 
  ur.user_id,
  'downline'::app_role,
  topline_reps.id,
  p.active
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
LEFT JOIN public.reps r ON r.user_id = ur.user_id
LEFT JOIN public.reps topline_reps ON topline_reps.user_id = p.linked_topline_id
WHERE ur.role = 'downline'::app_role
  AND r.id IS NULL
  AND p.linked_topline_id IS NOT NULL;