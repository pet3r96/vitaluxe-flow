-- Drop the old admin SELECT policy that uses email check
DROP POLICY IF EXISTS "Admin can view impersonation logs" ON impersonation_logs;

-- Create a new unified SELECT policy using role-based security
CREATE POLICY "View impersonation logs based on role"
ON impersonation_logs
FOR SELECT
TO authenticated
USING (
  -- Admins can see all logs
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Users can see logs where they were the target
  auth.uid() = target_user_id
);