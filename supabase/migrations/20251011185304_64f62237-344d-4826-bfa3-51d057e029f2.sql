-- Drop the old restrictive policy for messages
DROP POLICY IF EXISTS "Users can send messages to their threads" ON messages;

-- Create new policy that allows both self-messaging and admin impersonation
CREATE POLICY "Users can send messages to their threads"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    auth.uid() = sender_id 
    AND 
    is_thread_participant(auth.uid(), thread_id)
  )
  OR
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND
    is_thread_participant(sender_id, thread_id)
  )
);