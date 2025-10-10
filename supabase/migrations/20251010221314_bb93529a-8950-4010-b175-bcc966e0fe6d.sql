-- Fix infinite recursion in reps table RLS policies
DROP POLICY IF EXISTS "Toplines can view their downlines" ON reps;
DROP POLICY IF EXISTS "Downlines can view all toplines" ON reps;

-- Create security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_rep_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.reps WHERE user_id = _user_id LIMIT 1
$$;

-- Recreate safe policies on reps
DROP POLICY IF EXISTS "Reps can view own record" ON reps;
CREATE POLICY "Reps can view own record"
ON reps FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all reps" ON reps;
CREATE POLICY "Admins can manage all reps"
ON reps FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Toplines can view downlines assigned to them (no recursion)
CREATE POLICY "Toplines can view their downlines v2"
ON reps FOR SELECT
USING (
  role = 'downline'
  AND assigned_topline_id = get_user_rep_id(auth.uid())
  AND has_role(auth.uid(), 'topline'::app_role)
);

-- Downlines can view toplines (no recursion)
CREATE POLICY "Downlines can view toplines v2"
ON reps FOR SELECT
USING (
  role = 'topline'
  AND has_role(auth.uid(), 'downline'::app_role)
);

-- Drop policies that use rep_practice_links
DROP POLICY IF EXISTS "Downlines can view assigned practice orders" ON orders;
DROP POLICY IF EXISTS "Toplines can view downline practice orders" ON orders;
DROP POLICY IF EXISTS "Downlines can view order lines for their practices" ON order_lines;
DROP POLICY IF EXISTS "Toplines can view order lines for downline practices" ON order_lines;
DROP POLICY IF EXISTS "Reps can view profiles of assigned practices" ON profiles;

-- Recreate using profiles.linked_topline_id

-- Orders policies
CREATE POLICY "Downlines can view assigned practice orders v2"
ON orders FOR SELECT
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND doctor_id IN (
    SELECT p.id
    FROM profiles p
    JOIN reps r ON r.user_id = auth.uid()
    WHERE r.role = 'downline'
      AND r.assigned_topline_id IN (
        SELECT rt.id FROM reps rt WHERE rt.user_id = p.linked_topline_id
      )
  )
);

CREATE POLICY "Toplines can view downline practice orders v2"
ON orders FOR SELECT
USING (
  has_role(auth.uid(), 'topline'::app_role)
  AND doctor_id IN (
    SELECT id FROM profiles
    WHERE linked_topline_id = auth.uid()
      AND active = true
  )
);

-- Order lines policies
CREATE POLICY "Downlines can view order lines for their practices v2"
ON order_lines FOR SELECT
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND EXISTS (
    SELECT 1
    FROM orders o
    JOIN profiles p ON o.doctor_id = p.id
    JOIN reps r ON r.user_id = auth.uid()
    WHERE o.id = order_lines.order_id
      AND r.role = 'downline'
      AND r.assigned_topline_id IN (
        SELECT rt.id FROM reps rt WHERE rt.user_id = p.linked_topline_id
      )
  )
);

CREATE POLICY "Toplines can view order lines for downline practices v2"
ON order_lines FOR SELECT
USING (
  has_role(auth.uid(), 'topline'::app_role)
  AND EXISTS (
    SELECT 1
    FROM orders o
    JOIN profiles p ON o.doctor_id = p.id
    WHERE o.id = order_lines.order_id
      AND p.linked_topline_id = auth.uid()
      AND p.active = true
  )
);

-- Profiles policy
CREATE POLICY "Reps can view profiles of assigned practices v2"
ON profiles FOR SELECT
USING (
  (
    has_role(auth.uid(), 'downline'::app_role) AND
    id IN (
      SELECT p.id
      FROM profiles p
      JOIN reps r ON r.user_id = auth.uid()
      WHERE r.role = 'downline'
        AND r.assigned_topline_id IN (
          SELECT rt.id FROM reps rt WHERE rt.user_id = p.linked_topline_id
        )
    )
  )
  OR
  (
    has_role(auth.uid(), 'topline'::app_role) AND
    linked_topline_id = auth.uid() AND
    active = true
  )
);