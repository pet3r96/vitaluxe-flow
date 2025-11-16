-- ========================================
-- DDL Draft: message_threads
-- Status: DRAFT - DO NOT EXECUTE WITHOUT APPROVAL
-- ========================================

-- PURPOSE:
-- Organizes messages into threads (support tickets, order issues)
-- Different from patient_messages and internal_messages

-- EVIDENCE FROM CODEBASE:
-- Files using this table (15 matches):
-- - src/components/dashboard/RecentActivityWidget.tsx:64-142
-- - src/components/messages/MessagesView.tsx:155-630
-- - src/components/staff/StaffDiagnostics.tsx:52
--
-- Columns inferred from queries:
-- - id, created_at, updated_at
-- - subject (TEXT)
-- - thread_type (TEXT: 'support', 'order_issue', etc.)
-- - created_by (UUID, FK to profiles)
-- - resolved (BOOLEAN)
-- - resolved_at, resolved_by (TIMESTAMP, UUID)
-- - Relations: thread_participants, messages

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  thread_type TEXT NOT NULL DEFAULT 'support' CHECK (thread_type IN ('support', 'order_issue', 'general')),
  
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  resolved_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_threads_created_by 
  ON message_threads(created_by);
CREATE INDEX IF NOT EXISTS idx_message_threads_type 
  ON message_threads(thread_type);
CREATE INDEX IF NOT EXISTS idx_message_threads_resolved 
  ON message_threads(resolved, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_updated 
  ON message_threads(updated_at DESC);

-- RLS Policies
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

-- Creator can view their threads
CREATE POLICY "Creator can view their threads"
  ON message_threads FOR SELECT
  USING (created_by = auth.uid());

-- Admins can view all threads
CREATE POLICY "Admins can view all threads"
  ON message_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Participants can view threads they're part of
CREATE POLICY "Participants can view their threads"
  ON message_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM thread_participants 
      WHERE thread_id = message_threads.id 
      AND user_id = auth.uid()
    )
  );

-- Users can create threads
CREATE POLICY "Authenticated users can create threads"
  ON message_threads FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Creator and admins can update
CREATE POLICY "Creator and admins can update threads"
  ON message_threads FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE message_threads IS 'Organizes messages into threads for support tickets and issues';
