-- Add missing RLS policy for support ticket participants
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
      t.created_by = auth.uid() OR has_role(auth.uid(), 'admin')
    )
    AND (
      thread_participants.user_id = t.created_by OR has_role(thread_participants.user_id, 'admin')
    )
  )
);