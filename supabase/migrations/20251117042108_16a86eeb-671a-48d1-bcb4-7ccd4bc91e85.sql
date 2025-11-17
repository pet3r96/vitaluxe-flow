-- Enable RLS on medical_vault_audit_logs
ALTER TABLE medical_vault_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow patients to view their own audit logs
CREATE POLICY "Patients view own audit logs"
  ON medical_vault_audit_logs
  FOR SELECT
  USING (
    patient_account_id IN (
      SELECT id FROM patient_accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Allow practice staff to view logs for their own patients
CREATE POLICY "Staff view practice patient audit logs"
  ON medical_vault_audit_logs
  FOR SELECT
  USING (
    patient_account_id IN (
      SELECT pa.id 
      FROM patient_accounts pa
      JOIN practice_staff ps ON ps.practice_id = pa.practice_id
      WHERE ps.user_id = auth.uid()
        AND ps.active = true
    )
  );

-- Allow admins full access
CREATE POLICY "Admins manage all audit logs"
  ON medical_vault_audit_logs
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  );