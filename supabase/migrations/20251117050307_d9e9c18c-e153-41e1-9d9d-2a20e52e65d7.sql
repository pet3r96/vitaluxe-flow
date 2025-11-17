-- ================================================================
-- BATCH 6: RLS UPGRADES FOR HIGH-RISK SINGLE-POLICY TABLES
-- TABLES: internal_messages, internal_message_recipients, messages
-- ================================================================

-- ===========================
-- 1) INTERNAL_MESSAGES
-- ===========================

-- Practice staff can INSERT internal messages for their practice
CREATE POLICY "staff_insert_internal_messages"
  ON internal_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    practice_id IN (
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Practice staff can UPDATE internal messages in their practice
CREATE POLICY "staff_update_internal_messages"
  ON internal_messages FOR UPDATE
  TO authenticated
  USING (
    practice_id IN (
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    practice_id IN (
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Practice owners can manage their practice messages
CREATE POLICY "owner_manage_internal_messages"
  ON internal_messages FOR ALL
  TO authenticated
  USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());

-- Message creators can view their own messages
CREATE POLICY "creator_view_internal_messages"
  ON internal_messages FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Admins have full access
CREATE POLICY "admin_all_internal_messages"
  ON internal_messages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===========================
-- 2) INTERNAL_MESSAGE_RECIPIENTS
-- ===========================

-- Practice staff can INSERT recipients for their practice messages
CREATE POLICY "staff_insert_recipients"
  ON internal_message_recipients FOR INSERT
  TO authenticated
  WITH CHECK (
    message_id IN (
      SELECT im.id FROM internal_messages im
      JOIN practice_staff ps ON ps.practice_id = im.practice_id
      WHERE ps.user_id = auth.uid() AND ps.active = true
    )
  );

-- Recipients can UPDATE their read status
CREATE POLICY "recipient_update_read_status"
  ON internal_message_recipients FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Practice staff can view recipients for their practice messages
CREATE POLICY "staff_view_recipients"
  ON internal_message_recipients FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT im.id FROM internal_messages im
      JOIN practice_staff ps ON ps.practice_id = im.practice_id
      WHERE ps.user_id = auth.uid() AND ps.active = true
    )
  );

-- Admins have full access
CREATE POLICY "admin_all_recipients"
  ON internal_message_recipients FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===========================
-- 3) MESSAGES (general messaging)
-- ===========================

-- Thread participants can view messages in their threads
CREATE POLICY "participants_view_messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    thread_id IN (
      SELECT thread_id FROM messages
      WHERE sender_id = auth.uid()
      UNION
      SELECT id FROM message_threads
      WHERE created_by = auth.uid()
    )
  );

-- Thread participants can INSERT messages in their threads
CREATE POLICY "participants_insert_messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    thread_id IN (
      SELECT thread_id FROM messages
      WHERE sender_id = auth.uid()
      UNION
      SELECT id FROM message_threads
      WHERE created_by = auth.uid()
    )
  );

-- Practice staff can view messages for their practice threads
CREATE POLICY "staff_view_practice_messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    thread_id IN (
      SELECT mt.id FROM message_threads mt
      JOIN practice_staff ps ON ps.user_id = auth.uid()
      WHERE ps.active = true
    )
  );

-- Practice staff can send messages in their practice threads
CREATE POLICY "staff_insert_practice_messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    thread_id IN (
      SELECT mt.id FROM message_threads mt
      JOIN practice_staff ps ON ps.user_id = auth.uid()
      WHERE ps.active = true
    )
  );

-- Admins already have "Admins can view all messages" policy
-- Adding full admin access for other operations
CREATE POLICY "admin_insert_messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_messages"
  ON messages FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================
-- VERIFICATION QUERY
-- ===========================
SELECT tablename, 
  (SELECT count(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE t.schemaname = 'public' 
  AND t.tablename IN ('internal_messages','internal_message_recipients','messages')
ORDER BY tablename;