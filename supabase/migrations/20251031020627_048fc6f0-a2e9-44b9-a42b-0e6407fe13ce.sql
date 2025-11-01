-- Add RLS policies for Admins and Practice Staff to manage patient medical data

-- ============================================
-- PATIENT CONDITIONS
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_conditions' 
    AND policyname = 'Admins can manage patient conditions'
  ) THEN
    CREATE POLICY "Admins can manage patient conditions"
    ON public.patient_conditions
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_conditions' 
    AND policyname = 'Practice staff can manage patient conditions'
  ) THEN
    CREATE POLICY "Practice staff can manage patient conditions"
    ON public.patient_conditions
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_conditions.patient_account_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_conditions.patient_account_id
      )
    );
  END IF;
END $$;

-- ============================================
-- PATIENT ALLERGIES
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_allergies' 
    AND policyname = 'Admins can manage patient allergies'
  ) THEN
    CREATE POLICY "Admins can manage patient allergies"
    ON public.patient_allergies
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_allergies' 
    AND policyname = 'Practice staff can manage patient allergies'
  ) THEN
    CREATE POLICY "Practice staff can manage patient allergies"
    ON public.patient_allergies
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_allergies.patient_account_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_allergies.patient_account_id
      )
    );
  END IF;
END $$;

-- ============================================
-- PATIENT IMMUNIZATIONS
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_immunizations' 
    AND policyname = 'Admins can manage patient immunizations'
  ) THEN
    CREATE POLICY "Admins can manage patient immunizations"
    ON public.patient_immunizations
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_immunizations' 
    AND policyname = 'Practice staff can manage patient immunizations'
  ) THEN
    CREATE POLICY "Practice staff can manage patient immunizations"
    ON public.patient_immunizations
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_immunizations.patient_account_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_immunizations.patient_account_id
      )
    );
  END IF;
END $$;

-- ============================================
-- PATIENT SURGERIES
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_surgeries' 
    AND policyname = 'Admins can manage patient surgeries'
  ) THEN
    CREATE POLICY "Admins can manage patient surgeries"
    ON public.patient_surgeries
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_surgeries' 
    AND policyname = 'Practice staff can manage patient surgeries'
  ) THEN
    CREATE POLICY "Practice staff can manage patient surgeries"
    ON public.patient_surgeries
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_surgeries.patient_account_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_surgeries.patient_account_id
      )
    );
  END IF;
END $$;

-- ============================================
-- PATIENT PHARMACIES
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_pharmacies' 
    AND policyname = 'Admins can manage patient pharmacies'
  ) THEN
    CREATE POLICY "Admins can manage patient pharmacies"
    ON public.patient_pharmacies
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_pharmacies' 
    AND policyname = 'Practice staff can manage patient pharmacies'
  ) THEN
    CREATE POLICY "Practice staff can manage patient pharmacies"
    ON public.patient_pharmacies
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_pharmacies.patient_account_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_pharmacies.patient_account_id
      )
    );
  END IF;
END $$;

-- ============================================
-- PATIENT VITALS
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_vitals' 
    AND policyname = 'Admins can manage patient vitals'
  ) THEN
    CREATE POLICY "Admins can manage patient vitals"
    ON public.patient_vitals
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_vitals' 
    AND policyname = 'Practice staff can manage patient vitals'
  ) THEN
    CREATE POLICY "Practice staff can manage patient vitals"
    ON public.patient_vitals
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_vitals.patient_account_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_vitals.patient_account_id
      )
    );
  END IF;
END $$;

-- ============================================
-- PATIENT EMERGENCY CONTACTS
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_emergency_contacts' 
    AND policyname = 'Admins can manage patient emergency contacts'
  ) THEN
    CREATE POLICY "Admins can manage patient emergency contacts"
    ON public.patient_emergency_contacts
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_emergency_contacts' 
    AND policyname = 'Practice staff can manage patient emergency contacts'
  ) THEN
    CREATE POLICY "Practice staff can manage patient emergency contacts"
    ON public.patient_emergency_contacts
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_emergency_contacts.patient_account_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM practice_staff ps
        JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
        WHERE ps.user_id = auth.uid()
        AND pa.id = patient_emergency_contacts.patient_account_id
      )
    );
  END IF;
END $$;