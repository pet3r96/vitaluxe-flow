-- Phase 1: Create missing security definer functions for safe reps lookups

-- Get topline rep ID for a practice (by practice's linked_topline_id user_id)
CREATE OR REPLACE FUNCTION public.get_topline_rep_id_for_practice(_practice_linked_topline_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.reps 
  WHERE user_id = _practice_linked_topline_user_id 
    AND role = 'topline'::app_role
  LIMIT 1
$$;

-- Get current user's assigned topline rep ID (for downlines)
CREATE OR REPLACE FUNCTION public.get_my_topline_rep_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_topline_id FROM public.reps 
  WHERE user_id = auth.uid() 
    AND role = 'downline'::app_role
  LIMIT 1
$$;

-- Phase 2: Fix reps table policy - remove recursive subquery
DROP POLICY IF EXISTS "Downlines can view their topline" ON public.reps;

CREATE POLICY "Downlines can view their topline"
ON public.reps FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND role = 'topline'::app_role
  AND id = get_my_topline_rep_id()
);

-- Phase 3: Fix order_lines policies
DROP POLICY IF EXISTS "Downlines can view order lines for their practices v2" ON public.order_lines;

CREATE POLICY "Downlines can view order lines for their practices v2"
ON public.order_lines FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND EXISTS (
    SELECT 1
    FROM orders o
    JOIN profiles p ON o.doctor_id = p.id
    WHERE o.id = order_lines.order_id
      AND get_topline_rep_id_for_practice(p.linked_topline_id) = get_my_topline_rep_id()
  )
);

-- Phase 4: Fix orders policies
DROP POLICY IF EXISTS "Downlines can view assigned practice orders v2" ON public.orders;

CREATE POLICY "Downlines can view assigned practice orders v2"
ON public.orders FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND doctor_id IN (
    SELECT p.id
    FROM profiles p
    WHERE get_topline_rep_id_for_practice(p.linked_topline_id) = get_my_topline_rep_id()
  )
);

-- Phase 5: Fix order_profits policies
DROP POLICY IF EXISTS "Toplines can view their order profits" ON public.order_profits;
DROP POLICY IF EXISTS "Downlines can view their order profits" ON public.order_profits;

CREATE POLICY "Toplines can view their order profits"
ON public.order_profits FOR SELECT
TO authenticated
USING (
  topline_id = get_current_user_rep_id()
);

CREATE POLICY "Downlines can view their order profits"
ON public.order_profits FOR SELECT
TO authenticated
USING (
  downline_id = get_current_user_rep_id()
);