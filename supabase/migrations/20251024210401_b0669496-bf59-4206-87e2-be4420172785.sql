-- Drop existing admin view policy that uses has_role()
DROP POLICY IF EXISTS "Admins can view all order lines" ON order_lines;

-- Create updated policy that checks user_roles directly
-- This works during impersonation because it checks the actual logged-in user's role
CREATE POLICY "Admins can view all order lines"
ON order_lines FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);