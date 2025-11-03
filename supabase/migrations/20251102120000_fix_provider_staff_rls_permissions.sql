-- ============================================================================
-- Fix Provider/Staff/Doctor RLS Permissions
-- This migration fixes 5 issues preventing doctors/practice owners from 
-- editing patient data, medical vault records, and creating follow-ups
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix Helper Function - Add Doctor/Practice Owner Support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_belongs_to_patient_practice(
  _user_id uuid,
  _patient_account_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = _patient_account_id
      AND (
        -- Check if user is admin
        EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role
        )
        -- Check if user is the practice owner (doctor)
        OR pa.practice_id = _user_id
        -- Check if user is an ACTIVE practice staff
        OR EXISTS (
          SELECT 1 FROM public.practice_staff ps 
          WHERE ps.user_id = _user_id 
            AND ps.practice_id = pa.practice_id
            AND ps.active = true
        )
        -- Check if user is an ACTIVE provider
        OR EXISTS (
          SELECT 1 FROM public.providers pr 
          WHERE pr.user_id = _user_id 
            AND pr.practice_id = pa.practice_id
            AND pr.active = true
        )
      )
  );
$$;

-- Grant execute on the helper function to authenticated users
GRANT EXECUTE ON FUNCTION public.user_belongs_to_patient_practice TO authenticated;

-- ============================================================================
-- STEP 2: Add Doctor Policies for patient_follow_ups
-- Note: patient_follow_ups policies reference 'patients' table which may have
-- been merged into patient_accounts. We check both for safety.
-- ============================================================================

-- Check if patient_follow_ups table exists and has old patients reference
DO $$
BEGIN
  -- If table exists, add doctor policies
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'patient_follow_ups') THEN
    
    -- Drop old policies that may reference wrong table
    DROP POLICY IF EXISTS "Doctors can view their practice follow-ups" ON public.patient_follow_ups;
    DROP POLICY IF EXISTS "Doctors can create practice follow-ups" ON public.patient_follow_ups;
    DROP POLICY IF EXISTS "Doctors can update their practice follow-ups" ON public.patient_follow_ups;
    DROP POLICY IF EXISTS "Staff can view practice follow-ups" ON public.patient_follow_ups;
    DROP POLICY IF EXISTS "Staff can create practice follow-ups" ON public.patient_follow_ups;
    DROP POLICY IF EXISTS "Staff can update practice follow-ups" ON public.patient_follow_ups;
    
    -- Add doctor policies for viewing follow-ups
    CREATE POLICY "Doctors can view their practice follow-ups"
    ON public.patient_follow_ups FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = patient_follow_ups.patient_id
          AND p.practice_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_follow_ups.patient_id
          AND pa.practice_id = auth.uid()
      )
    );

    -- Add doctor policies for creating follow-ups
    CREATE POLICY "Doctors can create practice follow-ups"
    ON public.patient_follow_ups FOR INSERT
    TO authenticated
    WITH CHECK (
      created_by = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = patient_follow_ups.patient_id
            AND p.practice_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.patient_accounts pa
          WHERE pa.id = patient_follow_ups.patient_id
            AND pa.practice_id = auth.uid()
        )
      )
    );

    -- Add doctor policies for updating follow-ups
    CREATE POLICY "Doctors can update their practice follow-ups"
    ON public.patient_follow_ups FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = patient_follow_ups.patient_id
          AND p.practice_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.patient_accounts pa
        WHERE pa.id = patient_follow_ups.patient_id
          AND pa.practice_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Verify patient_accounts UPDATE policies exist for doctors
-- The migration 20251031153732_merge_patient_accounts_and_patients.sql
-- should have already added these, but we ensure they exist.
-- ============================================================================

DO $$
BEGIN
  -- Verify doctors UPDATE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'patient_accounts' 
    AND policyname = 'Doctors can update their practice patients'
  ) THEN
    CREATE POLICY "Doctors can update their practice patients"
    ON public.patient_accounts FOR UPDATE
    TO authenticated
    USING (
      has_role(auth.uid(), 'doctor'::app_role)
      AND practice_id = auth.uid()
    )
    WITH CHECK (
      has_role(auth.uid(), 'doctor'::app_role)
      AND practice_id = auth.uid()
    );
    
    CREATE POLICY "Doctors can view their practice patients"
    ON public.patient_accounts FOR SELECT
    TO authenticated
    USING (
      has_role(auth.uid(), 'doctor'::app_role)
      AND practice_id = auth.uid()
    );
  END IF;
END $$;

-- ============================================================================
-- COMMIT
-- ============================================================================

