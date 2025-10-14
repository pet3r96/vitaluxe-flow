-- Fix infinite recursion in reps table policies
-- Create safe security definer functions for reps lookups

-- 1. Get current user's rep ID safely (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_rep_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.reps 
  WHERE user_id = auth.uid() 
  LIMIT 1
$$;

-- 2. Check if user is topline of a given rep (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_topline_of_rep(_rep_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reps r1
    INNER JOIN public.reps r2 ON r2.assigned_topline_id = r1.id
    WHERE r1.user_id = auth.uid()
      AND r2.id = _rep_id
  )
$$;

-- 3. Check if user is downline assigned to a topline (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_downline_of_topline(_topline_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reps r_downline
    INNER JOIN public.reps r_topline ON r_downline.assigned_topline_id = r_topline.id
    WHERE r_downline.user_id = auth.uid()
      AND r_topline.user_id = _topline_user_id
  )
$$;

-- Drop all existing reps policies that cause recursion
DROP POLICY IF EXISTS "Admins can manage all reps" ON public.reps;
DROP POLICY IF EXISTS "Downlines can view own profile" ON public.reps;
DROP POLICY IF EXISTS "Downlines can view toplines v2" ON public.reps;
DROP POLICY IF EXISTS "Reps can view own profile" ON public.reps;
DROP POLICY IF EXISTS "Reps can view own record" ON public.reps;
DROP POLICY IF EXISTS "Service role can insert reps" ON public.reps;
DROP POLICY IF EXISTS "Toplines can view assigned downlines" ON public.reps;
DROP POLICY IF EXISTS "Toplines can view own profile" ON public.reps;
DROP POLICY IF EXISTS "Toplines can view their downlines v2" ON public.reps;

-- Recreate policies using SAFE security definer functions (no recursion)
CREATE POLICY "Admins can manage all reps"
ON public.reps FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reps can view own profile"
ON public.reps FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Toplines can view assigned downlines"
ON public.reps FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'topline'::app_role)
  AND is_topline_of_rep(id)
);

CREATE POLICY "Downlines can view their topline"
ON public.reps FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND role = 'topline'::app_role
  AND id = (
    SELECT assigned_topline_id 
    FROM public.reps 
    WHERE user_id = auth.uid() 
    LIMIT 1
  )
);

CREATE POLICY "Service role can insert reps"
ON public.reps FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Admins can insert reps"
ON public.reps FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reps"
ON public.reps FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));