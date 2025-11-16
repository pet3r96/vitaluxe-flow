-- ========================================
-- DDL Draft: patient_messages
-- Status: DRAFT - DO NOT EXECUTE WITHOUT APPROVAL
-- ========================================

-- PURPOSE:
-- Stores messages between patients and practice staff
-- Supports threading via parent_message_id

-- EVIDENCE FROM CODEBASE:
-- Files using this table (43 matches):
-- - src/components/dashboard/MessagesAndChatWidget.tsx:28
-- - src/components/messages/PatientMessagesTab.tsx:53+
-- - src/components/patient/MessageThread.tsx:28+
-- - src/pages/InternalChat.tsx:477-707
-- - src/pages/Support.tsx:34
-- - src/pages/patient/PatientMessages.tsx:48+
-- - src/pages/practice/PatientInbox.tsx:61+
--
-- Columns inferred from queries:
-- - id, created_at, updated_at
-- - practice_id (FK to profiles)
-- - patient_id (FK to patient_accounts)
-- - parent_message_id (nullable, self-reference for threading)
-- - subject (TEXT)
-- - body (TEXT)
-- - sender_type (TEXT: 'patient' | 'practice')
-- - read_at (TIMESTAMP, nullable)
-- - resolved (BOOLEAN)
-- - resolved_at, resolved_by (nullable)
-- - Files/relations: patient_accounts, profiles

CREATE TABLE IF NOT EXISTS patient_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  parent_message_id UUID NULL REFERENCES patient_messages(id) ON DELETE CASCADE,
  
  subject TEXT NULL,
  body TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'practice')),
  
  read_at TIMESTAMP WITH TIME ZONE NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  resolved_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_messages_practice 
  ON patient_messages(practice_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_patient 
  ON patient_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_parent 
  ON patient_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_resolved 
  ON patient_messages(practice_id, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_messages_created 
  ON patient_messages(created_at DESC);

-- RLS Policies
ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

-- Patients can view their own messages
CREATE POLICY "Patients can view their messages"
  ON patient_messages FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    )
  );

-- Practice staff can view their practice messages
CREATE POLICY "Practice can view their patient messages"
  ON patient_messages FOR SELECT
  USING (
    practice_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM practice_staff 
      WHERE user_id = auth.uid() 
      AND practice_id = patient_messages.practice_id 
      AND active = true
    ) OR
    EXISTS (
      SELECT 1 FROM providers
      WHERE user_id = auth.uid()
      AND practice_id = patient_messages.practice_id
    )
  );

-- Insert policies (patients and practice can send messages)
CREATE POLICY "Patients can send messages"
  ON patient_messages FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    ) AND
    sender_type = 'patient'
  );

CREATE POLICY "Practice can send messages"
  ON patient_messages FOR INSERT
  WITH CHECK (
    (practice_id = auth.uid() OR
     EXISTS (SELECT 1 FROM practice_staff WHERE user_id = auth.uid() AND practice_id = patient_messages.practice_id AND active = true) OR
     EXISTS (SELECT 1 FROM providers WHERE user_id = auth.uid() AND practice_id = patient_messages.practice_id)
    ) AND
    sender_type = 'practice'
  );

-- Update policies (mark as read, resolve)
CREATE POLICY "Practice can update their messages"
  ON patient_messages FOR UPDATE
  USING (
    practice_id = auth.uid() OR
    EXISTS (SELECT 1 FROM practice_staff WHERE user_id = auth.uid() AND practice_id = patient_messages.practice_id AND active = true) OR
    EXISTS (SELECT 1 FROM providers WHERE user_id = auth.uid() AND practice_id = patient_messages.practice_id)
  );

CREATE POLICY "Patients can mark their messages as read"
  ON patient_messages FOR UPDATE
  USING (
    patient_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid())
  );

COMMENT ON TABLE patient_messages IS 'Messages between patients and practice staff with threading support';
