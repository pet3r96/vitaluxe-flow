-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can create message threads" ON message_threads;

-- Create new policy that allows both self-creation and admin impersonation
CREATE POLICY "Users can create message threads"
ON message_threads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by 
  OR 
  has_role(auth.uid(), 'admin'::app_role)
);