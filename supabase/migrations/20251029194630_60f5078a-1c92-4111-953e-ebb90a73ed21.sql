-- Ensure unique acceptance per patient per terms and add read policy
DO $$ BEGIN
  -- Add unique constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'patient_terms_acceptances_user_terms_unique'
  ) THEN
    ALTER TABLE public.patient_terms_acceptances
    ADD CONSTRAINT patient_terms_acceptances_user_terms_unique UNIQUE (user_id, terms_id);
  END IF;

  -- Add index on user_id for faster lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'idx_patient_terms_acceptances_user_id'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_patient_terms_acceptances_user_id ON public.patient_terms_acceptances(user_id);
  END IF;

  -- Add SELECT policy if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'patient_terms_acceptances' 
      AND policyname = 'Users can select own acceptances'
  ) THEN
    CREATE POLICY "Users can select own acceptances"
      ON public.patient_terms_acceptances
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;