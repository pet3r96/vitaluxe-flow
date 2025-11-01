-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Patients can create their own share links" ON medical_vault_share_links;

-- Create updated INSERT policy that handles impersonation
CREATE POLICY "Patients can create their own share links"
ON medical_vault_share_links
FOR INSERT
WITH CHECK (
  -- Allow if patient is creating their own link
  patient_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
  OR
  -- Allow if admin is impersonating this patient
  patient_id IN (
    SELECT pa.id 
    FROM patient_accounts pa
    JOIN active_impersonation_sessions ais 
      ON ais.impersonated_user_id = pa.user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND ais.revoked = false
  )
);