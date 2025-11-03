-- Add policy for practice owners (doctors) to view audit logs for their patients
-- Practice owners have user_id = practice_id in the system
CREATE POLICY "Practice owners can view patient audit logs"
ON public.medical_vault_audit_logs
FOR SELECT
USING (
  patient_account_id IN (
    SELECT pa.id 
    FROM public.patient_accounts pa
    INNER JOIN public.user_roles ur ON ur.user_id = auth.uid()
    WHERE pa.practice_id = auth.uid()
      AND ur.role = 'doctor'
  )
);