-------------------------------------------------------
-- PHASE 5 — SECURITY HARDENING / FINAL RLS CLEANUP
-- TARGET TABLES:
--   patient_medical_vault_history  (new audit table)
--   patient_messages               (communication)
-- SAFE, COLUMN-AWARE, FULLY ROLE-BASED
-------------------------------------------------------

-----------------------------
-- 1️⃣ CREATE patient_medical_vault_history IF NEEDED
-----------------------------
CREATE TABLE IF NOT EXISTS patient_medical_vault_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_record_id uuid NOT NULL REFERENCES patient_medical_vault(id) ON DELETE CASCADE,
  patient_account_id uuid NOT NULL REFERENCES patient_accounts(id),
  changed_by uuid,
  change_type text CHECK (change_type IN ('created','updated','deleted')),
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE patient_medical_vault_history ENABLE ROW LEVEL SECURITY;

-- PATIENT — view own history
CREATE POLICY "patient_view_own_vault_history"
  ON patient_medical_vault_history FOR SELECT
  USING (
    patient_account_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    )
  );

-- PRACTICE / STAFF — view practice patient history
CREATE POLICY "staff_view_practice_patient_history"
  ON patient_medical_vault_history FOR SELECT
  USING (
    patient_account_id IN (
      SELECT pa.id FROM patient_accounts pa
      JOIN practice_staff ps ON ps.practice_id = pa.practice_id
      WHERE ps.user_id = auth.uid() AND ps.active = true
    )
  );

-- ADMIN — full access
CREATE POLICY "admin_all_vault_history"
  ON patient_medical_vault_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-----------------------------
-- 2️⃣ PATIENT_MESSAGES TABLE
-----------------------------
ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

-- Drop all legacy policies
DO $$
DECLARE p text;
BEGIN
  FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = 'patient_messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON patient_messages;', p);
  END LOOP;
END$$;

-- PATIENT — read & send own messages
CREATE POLICY "patient_view_own_messages"
  ON patient_messages FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "patient_send_message"
  ON patient_messages FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    )
  );

-- PRACTICE / STAFF — view messages for their patients
CREATE POLICY "staff_view_practice_messages"
  ON patient_messages FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- STAFF — reply to their patients
CREATE POLICY "staff_reply_to_patient"
  ON patient_messages FOR INSERT
  WITH CHECK (
    practice_id IN (
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- ADMIN — full access
CREATE POLICY "admin_all_patient_messages"
  ON patient_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));