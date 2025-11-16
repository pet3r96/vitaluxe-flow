-- ========================================
-- DDL Draft: internal_messages
-- Status: DRAFT - DO NOT EXECUTE WITHOUT APPROVAL
-- ========================================

-- PURPOSE:
-- Internal practice team communication
-- Can be linked to patients for context

-- EVIDENCE FROM CODEBASE:
-- Files using this table (20 matches):
-- - src/components/dashboard/MessagesAndChatWidget.tsx:86
-- - src/components/dashboard/TabbedCommunicationsWidget.tsx:89+
-- - src/components/internal-chat/CreateInternalMessageDialog.tsx:126+
-- - src/pages/InternalChat.tsx:96-455
--
-- Columns inferred from queries:
-- - id, created_at, updated_at
-- - practice_id (FK to profiles)
-- - created_by (FK to profiles/users)
-- - patient_id (nullable FK to patient_accounts - for context)
-- - subject (TEXT)
-- - body (TEXT)
-- - message_type (TEXT: 'task', 'question', 'fyi', etc.)
-- - priority (TEXT: 'low', 'normal', 'high', 'urgent')
-- - completed (BOOLEAN)
-- - completed_at (TIMESTAMP)
-- - Relations: internal_message_recipients, internal_message_replies

CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID NULL REFERENCES patient_accounts(id) ON DELETE SET NULL,
  
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'task' CHECK (message_type IN ('task', 'question', 'fyi', 'urgent')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  completed_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_messages_practice 
  ON internal_messages(practice_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_created_by 
  ON internal_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_internal_messages_patient 
  ON internal_messages(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_messages_completed 
  ON internal_messages(practice_id, completed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_messages_priority 
  ON internal_messages(practice_id, priority, completed) WHERE NOT completed;

-- RLS Policies
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

-- Practice team can view internal messages
CREATE POLICY "Practice team can view internal messages"
  ON internal_messages FOR SELECT
  USING (
    practice_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM practice_staff 
      WHERE user_id = auth.uid() 
      AND practice_id = internal_messages.practice_id 
      AND active = true
    ) OR
    EXISTS (
      SELECT 1 FROM providers
      WHERE user_id = auth.uid()
      AND practice_id = internal_messages.practice_id
    ) OR
    EXISTS (
      SELECT 1 FROM internal_message_recipients
      WHERE message_id = internal_messages.id
      AND recipient_id = auth.uid()
    )
  );

-- Practice team can create internal messages
CREATE POLICY "Practice team can create internal messages"
  ON internal_messages FOR INSERT
  WITH CHECK (
    practice_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM practice_staff 
      WHERE user_id = auth.uid() 
      AND practice_id = internal_messages.practice_id 
      AND active = true
    ) OR
    EXISTS (
      SELECT 1 FROM providers
      WHERE user_id = auth.uid()
      AND practice_id = internal_messages.practice_id
    )
  );

-- Practice team can update internal messages
CREATE POLICY "Practice team can update internal messages"
  ON internal_messages FOR UPDATE
  USING (
    practice_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM practice_staff 
      WHERE user_id = auth.uid() 
      AND practice_id = internal_messages.practice_id 
      AND active = true
    ) OR
    EXISTS (
      SELECT 1 FROM providers
      WHERE user_id = auth.uid()
      AND practice_id = internal_messages.practice_id
    ) OR
    created_by = auth.uid()
  );

-- Creator and practice owner can delete
CREATE POLICY "Creator can delete internal messages"
  ON internal_messages FOR DELETE
  USING (
    created_by = auth.uid() OR
    practice_id = auth.uid()
  );

COMMENT ON TABLE internal_messages IS 'Internal practice team communication with task tracking';
