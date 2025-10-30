-- Add RLS policy to allow admins to manage documents during impersonation
CREATE POLICY "Admins can manage documents during impersonation"
  ON public.patient_documents FOR ALL
  USING (
    -- Admin is currently impersonating this patient
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
    -- Same check for INSERT/UPDATE
    EXISTS (
      SELECT 1 
      FROM active_impersonation_sessions ais
      JOIN patient_accounts pa ON pa.user_id = ais.impersonated_user_id
      WHERE ais.admin_user_id = auth.uid()
        AND ais.expires_at > now()
        AND pa.id = patient_documents.patient_id
    )
  );