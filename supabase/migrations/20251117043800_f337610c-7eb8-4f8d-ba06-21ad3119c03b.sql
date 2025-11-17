-----------------------------------------------
-- BATCH 2 — ENABLE RLS ON MEDIUM-RISK TABLES
-----------------------------------------------

-- 1️⃣ message_thread_read_status
ALTER TABLE message_thread_read_status ENABLE ROW LEVEL SECURITY;

-- Participants (anyone who sent a message in the thread) can see read status
CREATE POLICY "Participants view message read status"
  ON message_thread_read_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM messages m
      WHERE m.thread_id = message_thread_read_status.thread_id
        AND m.sender_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

-- Admin full access
CREATE POLICY "Admins manage read status"
  ON message_thread_read_status
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));


-- 2️⃣ practice_automation_settings
ALTER TABLE practice_automation_settings ENABLE ROW LEVEL SECURITY;

-- Practice owners can manage their automation settings
CREATE POLICY "Practice owners manage automation settings"
  ON practice_automation_settings
  FOR ALL
  USING (practice_id = auth.uid());

-- Active staff can view their practice automation settings
CREATE POLICY "Staff view automation settings"
  ON practice_automation_settings
  FOR SELECT
  USING (
    practice_id IN (
      SELECT ps.practice_id
      FROM practice_staff ps
      WHERE ps.user_id = auth.uid()
        AND ps.active = true
    )
  );

-- System admins full access
CREATE POLICY "Admins manage automation settings"
  ON practice_automation_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));