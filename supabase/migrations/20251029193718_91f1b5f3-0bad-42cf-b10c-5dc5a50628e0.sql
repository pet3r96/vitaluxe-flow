-- Allow authenticated users to insert their own patient terms acceptances
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'patient_terms_acceptances' 
      AND policyname = 'Users can insert own acceptances'
  ) THEN
    CREATE POLICY "Users can insert own acceptances"
      ON public.patient_terms_acceptances
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;