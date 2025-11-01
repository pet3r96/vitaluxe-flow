-- Fix RLS policy for internal_message_replies to allow recipients to reply
DROP POLICY IF EXISTS "Users can reply to messages they are recipients of" ON internal_message_replies;

CREATE POLICY "Users can reply to messages they are recipients of"
ON internal_message_replies
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM internal_message_recipients
    WHERE message_id = internal_message_replies.message_id
    AND recipient_id = auth.uid()
  )
  OR
  -- Also allow the original sender to reply
  EXISTS (
    SELECT 1 FROM internal_messages
    WHERE id = internal_message_replies.message_id
    AND sender_id = auth.uid()
  )
);

-- Enable realtime for internal_message_replies (skip if already added)
DO $$
BEGIN
  ALTER TABLE internal_message_replies REPLICA IDENTITY FULL;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'internal_message_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE internal_message_replies;
  END IF;
END $$;

-- Enable realtime for internal_messages (skip if already added)
DO $$
BEGIN
  ALTER TABLE internal_messages REPLICA IDENTITY FULL;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'internal_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
  END IF;
END $$;