-- Fix infinite recursion in practice_staff RLS policy
-- Drop the broken policy that causes circular reference
DROP POLICY IF EXISTS "practice_owner_manage_staff" ON practice_staff;

-- Recreate with proper logic using providers table (no circular reference)
CREATE POLICY "practice_owner_manage_staff"
ON practice_staff
FOR ALL
USING (
  -- Allow if user is practice owner (has provider/doctor role + matches practice_id)
  practice_id IN (
    SELECT p.practice_id 
    FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.active = true
  )
  OR
  -- Allow if user is admin
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  practice_id IN (
    SELECT p.practice_id 
    FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.active = true
  )
  OR
  has_role(auth.uid(), 'admin'::app_role)
);