-- ========================================
-- DDL Draft: internal_message_recipients
-- Status: DRAFT - DO NOT EXECUTE WITHOUT APPROVAL
-- ========================================

-- PURPOSE:
-- Tracks who should receive/see each internal message
-- Supports read status tracking

-- EVIDENCE FROM CODEBASE:
-- Files using this table:
-- - src/pages/InternalChat.tsx:100-104 (in select query)
-- - src/pages/InternalChat.tsx:147-149 (recipient tracking)
-- - src/components/internal-chat/CreateInternalMessageDialog.tsx:172-174 (insert)
--
-- Columns inferred from code:
-- - id (PK)
-- - message_id (FK to internal_messages)
-- - recipient_id (FK to profiles/users)
-- - read_at (TIMESTAMP, nullable)
-- - created_at

CREATE TABLE IF NOT EXISTS internal_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  read_at TIMESTAMP WITH TIME ZONE NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate recipients
  UNIQUE(message_id, recipient_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_message_recipients_message 
  ON internal_message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_internal_message_recipients_recipient 
  ON internal_message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_internal_message_recipients_unread 
  ON internal_message_recipients(recipient_id, read_at) 
  WHERE read_at IS NULL;

-- RLS Policies
ALTER TABLE internal_message_recipients ENABLE ROW LEVEL SECURITY;

-- Recipients can view their assignments
CREATE POLICY "Recipients can view their assignments"
  ON internal_message_recipients FOR SELECT
  USING (
    recipient_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM internal_messages 
      WHERE id = internal_message_recipients.message_id
      AND (
        practice_id = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM practice_staff 
          WHERE user_id = auth.uid() 
          AND practice_id = internal_messages.practice_id 
          AND active = true
        )
      )
    )
  );

-- Practice team can add recipients
CREATE POLICY "Practice team can add recipients"
  ON internal_message_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM internal_messages 
      WHERE id = internal_message_recipients.message_id
      AND (
        practice_id = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM practice_staff 
          WHERE user_id = auth.uid() 
          AND practice_id = internal_messages.practice_id 
          AND active = true
        )
      )
    )
  );

-- Recipients can mark as read
CREATE POLICY "Recipients can mark as read"
  ON internal_message_recipients FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

COMMENT ON TABLE internal_message_recipients IS 'Tracks recipients and read status for internal messages';
