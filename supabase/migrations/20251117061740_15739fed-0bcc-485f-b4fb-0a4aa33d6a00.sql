-- 1) Remove any old/broken version
DROP POLICY IF EXISTS "practice_owner_manage_staff" ON practice_staff;

-- 2) Create corrected non-recursive policy
CREATE POLICY "practice_owner_manage_staff"
ON practice_staff
FOR ALL
USING (
  -- Allow if user is the owner of the practice (based on providers table)
  practice_id IN (
    SELECT p.practice_id
    FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.active = true
  )
  OR
  -- Allow admins full access
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