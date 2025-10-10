-- Step 1: Create security definer helper functions to safely check rep-practice relationships
CREATE OR REPLACE FUNCTION public.can_downline_view_practice(_downline_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN reps r ON r.user_id = _downline_user_id
    WHERE p.id = _practice_id
      AND r.role = 'downline'
      AND r.assigned_topline_id IN (
        SELECT rt.id FROM reps rt WHERE rt.user_id = p.linked_topline_id
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_topline_view_practice(_topline_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = _practice_id
      AND p.linked_topline_id = _topline_user_id
      AND p.active = true
  )
$$;

-- Step 2: Drop the problematic policy causing infinite recursion
DROP POLICY IF EXISTS "Reps can view profiles of assigned practices v2" ON profiles;

-- Step 3: Recreate the policy using security definer functions (no recursion)
CREATE POLICY "Reps can view profiles of assigned practices v3"
ON profiles FOR SELECT
USING (
  (
    has_role(auth.uid(), 'downline'::app_role)
    AND can_downline_view_practice(auth.uid(), id)
  )
  OR
  (
    has_role(auth.uid(), 'topline'::app_role)
    AND can_topline_view_practice(auth.uid(), id)
  )
);