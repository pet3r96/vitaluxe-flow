-- Allow providers to view audit logs for patients in their practice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'medical_vault_audit_logs' 
      AND policyname = 'Providers can view patient audit logs'
  ) THEN
    CREATE POLICY "Providers can view patient audit logs"
    ON public.medical_vault_audit_logs
    FOR SELECT
    TO public
    USING (
      patient_account_id IN (
        SELECT pa.id
        FROM public.patient_accounts pa
        JOIN public.providers p ON pa.practice_id = p.practice_id
        WHERE p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Allow admins to view all audit logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'medical_vault_audit_logs' 
      AND policyname = 'Admins can view all patient audit logs'
  ) THEN
    CREATE POLICY "Admins can view all patient audit logs"
    ON public.medical_vault_audit_logs
    FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
          AND ur.role = 'admin'
      )
    );
  END IF;
END $$;