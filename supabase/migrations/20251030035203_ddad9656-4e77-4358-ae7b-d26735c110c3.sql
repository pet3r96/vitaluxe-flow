-- Drop the existing impersonation policy
DROP POLICY IF EXISTS "Admins can manage documents during impersonation" ON patient_documents;

-- Recreate with proper INSERT handling
CREATE POLICY "Admins can manage documents during impersonation" 
ON patient_documents
FOR ALL
USING (
  -- For SELECT/UPDATE/DELETE: Check existing patient_id
  EXISTS (
    SELECT 1 
    FROM active_impersonation_sessions ais
    JOIN patient_accounts pa ON pa.user_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND pa.id = patient_documents.patient_id
  )
)
WITH CHECK (
  -- For INSERT/UPDATE: Check the patient_id being written
  patient_id IN (
    SELECT pa.id
    FROM active_impersonation_sessions ais
    JOIN patient_accounts pa ON pa.user_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
  )
);