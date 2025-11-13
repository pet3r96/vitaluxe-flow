-- ============================================================================
-- Phase 2: Add Rep RLS Policies for Orders and Order Lines (Final)
-- ============================================================================
-- This migration adds database-level security for topline and downline reps
-- to view orders from their assigned practices

-- 1. Create security definer function to get practice IDs for topline reps
-- Returns array of practice IDs where the user is the linked topline rep
CREATE OR REPLACE FUNCTION public.get_topline_practice_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT id)
  FROM profiles
  WHERE linked_topline_id = _user_id
    AND id IS NOT NULL;
$$;

-- 2. Create security definer function to get practice IDs for downline reps
-- Returns array of practice IDs linked via rep_practice_links
CREATE OR REPLACE FUNCTION public.get_downline_practice_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT practice_id)
  FROM rep_practice_links
  WHERE rep_id = _user_id
    AND practice_id IS NOT NULL;
$$;

-- 3. Create security definer function to check if user is a topline rep
-- Topline reps have assigned_topline_id IS NULL
CREATE OR REPLACE FUNCTION public.is_topline_rep(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM reps
    WHERE user_id = _user_id
      AND assigned_topline_id IS NULL
      AND active = true
  );
$$;

-- 4. Create security definer function to check if user is a downline rep
-- Downline reps have assigned_topline_id IS NOT NULL
CREATE OR REPLACE FUNCTION public.is_downline_rep(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM reps
    WHERE user_id = _user_id
      AND assigned_topline_id IS NOT NULL
      AND active = true
  );
$$;

-- 5. Add RLS policy for topline reps to view orders from their practices
CREATE POLICY "Topline reps can view their practice orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_topline_rep(auth.uid()) 
  AND doctor_id = ANY(get_topline_practice_ids(auth.uid()))
);

-- 6. Add RLS policy for downline reps to view orders from their practices
CREATE POLICY "Downline reps can view their practice orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_downline_rep(auth.uid())
  AND doctor_id = ANY(get_downline_practice_ids(auth.uid()))
);

-- 7. Add RLS policy for topline reps to view order lines from their practices
CREATE POLICY "Topline reps can view their practice order lines"
ON public.order_lines
FOR SELECT
TO authenticated
USING (
  is_topline_rep(auth.uid())
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_lines.order_id
      AND orders.doctor_id = ANY(get_topline_practice_ids(auth.uid()))
  )
);

-- 8. Add RLS policy for downline reps to view order lines from their practices
CREATE POLICY "Downline reps can view their practice order lines"
ON public.order_lines
FOR SELECT
TO authenticated
USING (
  is_downline_rep(auth.uid())
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_lines.order_id
      AND orders.doctor_id = ANY(get_downline_practice_ids(auth.uid()))
  )
);

-- 9. Add helpful comments
COMMENT ON FUNCTION public.get_topline_practice_ids IS 'Returns practice IDs linked to a topline rep via profiles.linked_topline_id';
COMMENT ON FUNCTION public.get_downline_practice_ids IS 'Returns practice IDs linked to a downline rep via rep_practice_links';
COMMENT ON FUNCTION public.is_topline_rep IS 'Checks if user is a topline rep (assigned_topline_id IS NULL)';
COMMENT ON FUNCTION public.is_downline_rep IS 'Checks if user is a downline rep (assigned_topline_id IS NOT NULL)';