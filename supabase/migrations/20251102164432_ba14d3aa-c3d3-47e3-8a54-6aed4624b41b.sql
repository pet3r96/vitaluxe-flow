-- Update RLS policy to handle impersonation scenarios
DROP POLICY IF EXISTS "Add participants to support tickets (creator/admin)" ON thread_participants;

CREATE POLICY "Add participants to support tickets (creator/admin)"
ON thread_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM message_threads t
    WHERE t.id = thread_participants.thread_id
    AND t.thread_type = 'support'
    AND (
      -- Allow if user created the thread
      t.created_by = auth.uid() 
      -- Allow if user is admin (covers impersonation scenarios)
      OR has_role(auth.uid(), 'admin') 
      -- Allow if user has impersonation permission (admin impersonating others)
      OR EXISTS (
        SELECT 1 FROM impersonation_permissions ip
        WHERE ip.user_id = auth.uid() 
        AND ip.can_impersonate = true
        AND ip.revoked_at IS NULL
      )
    )
  )
);