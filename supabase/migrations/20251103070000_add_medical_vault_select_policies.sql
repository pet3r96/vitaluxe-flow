-- ============================================================================
-- ADD MISSING SELECT POLICIES FOR MEDICAL VAULT TABLES
-- 
-- Issue: Migration 20251103015819 created INSERT and UPDATE policies for
-- medical vault tables but MISSING SELECT policies, preventing users from
-- viewing medical vault records.
--
-- This migration adds SELECT policies for:
-- 1. Admins (can view all)
-- 2. Practice users (doctors, providers, staff) using fixed function
-- 3. Patients (can view their own records)
--
-- IMPORTANT: This uses the FIXED user_belongs_to_patient_practice function
-- from consolidation migration 20251103060000
-- ============================================================================

BEGIN;

-- Only apply policies if tables exist (safety check)
DO $$
BEGIN
  -- ============================================================================
  -- PATIENT_CONDITIONS - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_conditions') THEN
    -- Drop existing policies if they exist (idempotent)
    DROP POLICY IF EXISTS "Admins can view all conditions" ON public.patient_conditions;
    DROP POLICY IF EXISTS "Practice users can view their patients' conditions" ON public.patient_conditions;
    DROP POLICY IF EXISTS "Patients can view their own conditions" ON public.patient_conditions;
    
    -- Admins can view all conditions
    CREATE POLICY "Admins can view all conditions"
    ON public.patient_conditions FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' conditions
    CREATE POLICY "Practice users can view their patients' conditions"
    ON public.patient_conditions FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own conditions
    CREATE POLICY "Patients can view their own conditions"
    ON public.patient_conditions FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_conditions.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;
END $$;

  -- ============================================================================
  -- PATIENT_MEDICATIONS - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_medications') THEN
    DROP POLICY IF EXISTS "Admins can view all medications" ON public.patient_medications;
    DROP POLICY IF EXISTS "Practice users can view their patients' medications" ON public.patient_medications;
    DROP POLICY IF EXISTS "Patients can view their own medications" ON public.patient_medications;
    
    -- Admins can view all medications
    CREATE POLICY "Admins can view all medications"
    ON public.patient_medications FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' medications
    CREATE POLICY "Practice users can view their patients' medications"
    ON public.patient_medications FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own medications
    CREATE POLICY "Patients can view their own medications"
    ON public.patient_medications FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_medications.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;

  -- ============================================================================
  -- PATIENT_ALLERGIES - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_allergies') THEN
    DROP POLICY IF EXISTS "Admins can view all allergies" ON public.patient_allergies;
    DROP POLICY IF EXISTS "Practice users can view their patients' allergies" ON public.patient_allergies;
    DROP POLICY IF EXISTS "Patients can view their own allergies" ON public.patient_allergies;
    
    -- Admins can view all allergies
    CREATE POLICY "Admins can view all allergies"
    ON public.patient_allergies FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' allergies
    CREATE POLICY "Practice users can view their patients' allergies"
    ON public.patient_allergies FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own allergies
    CREATE POLICY "Patients can view their own allergies"
    ON public.patient_allergies FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_allergies.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;

  -- ============================================================================
  -- PATIENT_VITALS - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_vitals') THEN
    DROP POLICY IF EXISTS "Admins can view all vitals" ON public.patient_vitals;
    DROP POLICY IF EXISTS "Practice users can view their patients' vitals" ON public.patient_vitals;
    DROP POLICY IF EXISTS "Patients can view their own vitals" ON public.patient_vitals;
    
    -- Admins can view all vitals
    CREATE POLICY "Admins can view all vitals"
    ON public.patient_vitals FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' vitals
    CREATE POLICY "Practice users can view their patients' vitals"
    ON public.patient_vitals FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own vitals
    CREATE POLICY "Patients can view their own vitals"
    ON public.patient_vitals FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_vitals.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;

  -- ============================================================================
  -- PATIENT_IMMUNIZATIONS - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_immunizations') THEN
    DROP POLICY IF EXISTS "Admins can view all immunizations" ON public.patient_immunizations;
    DROP POLICY IF EXISTS "Practice users can view their patients' immunizations" ON public.patient_immunizations;
    DROP POLICY IF EXISTS "Patients can view their own immunizations" ON public.patient_immunizations;
    
    -- Admins can view all immunizations
    CREATE POLICY "Admins can view all immunizations"
    ON public.patient_immunizations FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' immunizations
    CREATE POLICY "Practice users can view their patients' immunizations"
    ON public.patient_immunizations FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own immunizations
    CREATE POLICY "Patients can view their own immunizations"
    ON public.patient_immunizations FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_immunizations.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;

  -- ============================================================================
  -- PATIENT_SURGERIES - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_surgeries') THEN
    DROP POLICY IF EXISTS "Admins can view all surgeries" ON public.patient_surgeries;
    DROP POLICY IF EXISTS "Practice users can view their patients' surgeries" ON public.patient_surgeries;
    DROP POLICY IF EXISTS "Patients can view their own surgeries" ON public.patient_surgeries;
    
    -- Admins can view all surgeries
    CREATE POLICY "Admins can view all surgeries"
    ON public.patient_surgeries FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' surgeries
    CREATE POLICY "Practice users can view their patients' surgeries"
    ON public.patient_surgeries FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own surgeries
    CREATE POLICY "Patients can view their own surgeries"
    ON public.patient_surgeries FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_surgeries.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;

  -- ============================================================================
  -- PATIENT_PHARMACIES - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_pharmacies') THEN
    DROP POLICY IF EXISTS "Admins can view all patient pharmacies" ON public.patient_pharmacies;
    DROP POLICY IF EXISTS "Practice users can view their patients' pharmacies" ON public.patient_pharmacies;
    DROP POLICY IF EXISTS "Patients can view their own pharmacies" ON public.patient_pharmacies;
    
    -- Admins can view all patient pharmacies
    CREATE POLICY "Admins can view all patient pharmacies"
    ON public.patient_pharmacies FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' pharmacies
    CREATE POLICY "Practice users can view their patients' pharmacies"
    ON public.patient_pharmacies FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own pharmacies
    CREATE POLICY "Patients can view their own pharmacies"
    ON public.patient_pharmacies FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_pharmacies.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;

  -- ============================================================================
  -- PATIENT_EMERGENCY_CONTACTS - Add SELECT policies
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_emergency_contacts') THEN
    DROP POLICY IF EXISTS "Admins can view all emergency contacts" ON public.patient_emergency_contacts;
    DROP POLICY IF EXISTS "Practice users can view their patients' emergency contacts" ON public.patient_emergency_contacts;
    DROP POLICY IF EXISTS "Patients can view their own emergency contacts" ON public.patient_emergency_contacts;
    
    -- Admins can view all emergency contacts
    CREATE POLICY "Admins can view all emergency contacts"
    ON public.patient_emergency_contacts FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

    -- Practice users can view their patients' emergency contacts
    CREATE POLICY "Practice users can view their patients' emergency contacts"
    ON public.patient_emergency_contacts FOR SELECT
    TO authenticated
    USING (
      public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
    );

    -- Patients can view their own emergency contacts
    CREATE POLICY "Patients can view their own emergency contacts"
    ON public.patient_emergency_contacts FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_emergency_contacts.patient_account_id
        AND pa.user_id = auth.uid()
      )
    );
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- After running this migration, verify:
-- 1. Admins can view all medical vault records
-- 2. Doctors can view their practice patients' medical vault records
-- 3. Providers can view their practice patients' medical vault records
-- 4. Staff can view their practice patients' medical vault records
-- 5. Patients can view their own medical vault records
-- 6. Practice users can still INSERT and UPDATE (from migration 20251103015819)
-- ============================================================================

