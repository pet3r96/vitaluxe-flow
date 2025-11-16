-- ============================================================================
-- Phase D: RLS Policy Creation
-- Safe to re-run (uses IF EXISTS / IF NOT EXISTS)
-- ============================================================================

-- D1: Enable RLS on prescriptions table
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- D2: Create prescriptions policies (practice-scoped + patient access)
DROP POLICY IF EXISTS rx_select_practice ON prescriptions;
CREATE POLICY rx_select_practice ON prescriptions
FOR SELECT TO authenticated
USING (
  practice_id IN (
    SELECT practice_id FROM providers WHERE user_id = auth.uid()
    UNION
    SELECT practice_id FROM practice_staff WHERE user_id = auth.uid()
  )
  OR patient_account_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS rx_insert_provider ON prescriptions;
CREATE POLICY rx_insert_provider ON prescriptions
FOR INSERT TO authenticated
WITH CHECK (
  provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS rx_update_provider ON prescriptions;
CREATE POLICY rx_update_provider ON prescriptions
FOR UPDATE TO authenticated
USING (
  provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- D3: Add practice_staff access to patient_medical_vault
DROP POLICY IF EXISTS vault_select_practice_staff ON patient_medical_vault;
CREATE POLICY vault_select_practice_staff ON patient_medical_vault
FOR SELECT TO authenticated
USING (
  patient_id IN (
    SELECT pa.id
    FROM patient_accounts pa
    JOIN practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE ps.user_id = auth.uid()
  )
);

-- D4: Add admin override to user_sessions
DROP POLICY IF EXISTS sess_admin_view ON user_sessions;
CREATE POLICY sess_admin_view ON user_sessions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- D5: Add practice_staff access to audit_logs
DROP POLICY IF EXISTS audit_select_practice_staff ON audit_logs;
CREATE POLICY audit_select_practice_staff ON audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id::text = (audit_logs.details->>'practice_id')
  )
);

-- D6: Strengthen messages policy with admin access
DROP POLICY IF EXISTS msg_select_participants ON messages;
CREATE POLICY msg_select_participants ON messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM thread_participants tp
    WHERE tp.thread_id = messages.thread_id
      AND tp.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);