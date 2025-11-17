-- Enable RLS
ALTER TABLE medical_vault_share_links ENABLE ROW LEVEL SECURITY;

-- Patients can view their own shared links
CREATE POLICY "Patients view their own share links"
  ON medical_vault_share_links
  FOR SELECT
  USING (
    patient_account_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    )
  );

-- Patients can insert/delete their own share links (revoke access)
CREATE POLICY "Patients manage their own share links"
  ON medical_vault_share_links
  FOR ALL
  USING (
    patient_account_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_account_id IN (
      SELECT id FROM patient_accounts WHERE user_id = auth.uid()
    )
  );

-- Admins full access
CREATE POLICY "Admins manage all share links"
  ON medical_vault_share_links
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));