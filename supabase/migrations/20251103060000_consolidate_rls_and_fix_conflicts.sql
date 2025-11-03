-- ============================================================================
-- CONSOLIDATE RLS POLICIES AND FIX FUNCTION CONFLICTS
-- 
-- This migration:
-- 1. Fixes user_belongs_to_patient_practice function duplication
-- 2. Consolidates patient_accounts RLS policies
-- 3. Consolidates patient_follow_ups RLS policies  
-- 4. Removes references to legacy 'patients' table
--
-- IMPORTANT: This is SAFE - it only removes duplicates and consolidates
-- existing working logic. No new permissions are granted.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Fix user_belongs_to_patient_practice Function (CONSOLIDATE DUPLICATES)
-- ============================================================================

-- Use the SINGLE definitive version that checks all 4 role types
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
        -- Admin users can access any patient
        EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role
        )
        -- Practice owner (doctor) can access their patients
        OR pa.practice_id = _user_id
        -- Active staff can access patients in their practice
        OR EXISTS (
          SELECT 1 FROM public.practice_staff ps 
          WHERE ps.user_id = _user_id 
            AND ps.practice_id = pa.practice_id
            AND ps.active = true
        )
        -- Active providers can access patients in their practice
        OR EXISTS (
          SELECT 1 FROM public.providers pr 
          WHERE pr.user_id = _user_id 
            AND pr.practice_id = pa.practice_id
            AND pr.active = true
        )
      )
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_belongs_to_patient_practice TO authenticated;

-- ============================================================================
-- STEP 2: Consolidate patient_accounts RLS Policies
-- ============================================================================

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Admins can manage all patient accounts" ON public.patient_accounts;
DROP POLICY IF EXISTS "Admins can view all patient accounts" ON public.patient_accounts;
DROP POLICY IF EXISTS "Admins can update all patient accounts" ON public.patient_accounts;
DROP POLICY IF EXISTS "Admins can create patient accounts" ON public.patient_accounts;
DROP POLICY IF EXISTS "Doctors can view their practice patients" ON public.patient_accounts;
DROP POLICY IF EXISTS "Doctors can create patients for their practice" ON public.patient_accounts;
DROP POLICY IF EXISTS "Doctors can update their practice patients" ON public.patient_accounts;
DROP POLICY IF EXISTS "Providers can view their practice patients" ON public.patient_accounts;
DROP POLICY IF EXISTS "Providers can create patients for their practice" ON public.patient_accounts;
DROP POLICY IF EXISTS "Providers can update their practice patients" ON public.patient_accounts;
DROP POLICY IF EXISTS "Staff can create patients for their practice" ON public.patient_accounts;
DROP POLICY IF EXISTS "Patients can view their own account" ON public.patient_accounts;
DROP POLICY IF EXISTS "Patients can update their own account" ON public.patient_accounts;
DROP POLICY IF EXISTS "Patients can view their own medical vault" ON public.patient_accounts;
DROP POLICY IF EXISTS "Practices can view their patients" ON public.patient_accounts;

-- CREATE POLICIES: SELECT (View)
-- ============================================================================

-- Admins can view all patient accounts
CREATE POLICY "Admins can view all patient accounts"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Doctors can view their practice patients
CREATE POLICY "Doctors can view their practice patients"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND practice_id = auth.uid()
);

-- Providers can view their practice patients
CREATE POLICY "Providers can view their practice patients"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
    AND p.active = true
  )
);

-- Staff can view their practice patients
CREATE POLICY "Staff can view their practice patients"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.practice_id = patient_accounts.practice_id
    AND ps.active = true
  )
);

-- Patients can view their own account
CREATE POLICY "Patients can view their own account"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- CREATE POLICIES: INSERT (Create)
-- ============================================================================

-- Admins can create patient accounts in any practice
CREATE POLICY "Admins can create patient accounts"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Doctors can create patients for their own practice
CREATE POLICY "Doctors can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND practice_id = auth.uid()
);

-- Providers can create patients for their practice
CREATE POLICY "Providers can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
    AND p.active = true
  )
);

-- Staff can create patients for their practice
CREATE POLICY "Staff can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.practice_id = patient_accounts.practice_id
    AND ps.active = true
  )
);

-- CREATE POLICIES: UPDATE (Edit)
-- ============================================================================

-- Admins can update all patient accounts
CREATE POLICY "Admins can update all patient accounts"
ON public.patient_accounts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Doctors can update their practice patients
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

-- Providers can update their practice patients
CREATE POLICY "Providers can update their practice patients"
ON public.patient_accounts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
    AND p.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
    AND p.active = true
  )
);

-- Staff can update their practice patients
CREATE POLICY "Staff can update their practice patients"
ON public.patient_accounts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.practice_id = patient_accounts.practice_id
    AND ps.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.practice_id = patient_accounts.practice_id
    AND ps.active = true
  )
);

-- Patients can update their own account
CREATE POLICY "Patients can update their own account"
ON public.patient_accounts FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- STEP 3: Consolidate patient_follow_ups RLS Policies
-- ============================================================================

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Doctors can view their practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Doctors can create practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Doctors can create follow-ups for their patients" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Doctors can update their practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Staff can view practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Staff can create practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Staff can update practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Providers can view practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Providers can create practice follow-ups" ON public.patient_follow_ups;
DROP POLICY IF EXISTS "Providers can update practice follow-ups" ON public.patient_follow_ups;

-- CREATE POLICIES: SELECT (View)
-- ============================================================================

-- Doctors can view follow-ups for their practice patients
CREATE POLICY "Doctors can view their practice follow-ups"
ON public.patient_follow_ups FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = patient_follow_ups.patient_id
    AND pa.practice_id = auth.uid()
  )
);

-- Providers can view follow-ups for their practice patients
CREATE POLICY "Providers can view their practice follow-ups"
ON public.patient_follow_ups FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    JOIN public.providers pr ON pr.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND pr.user_id = auth.uid()
    AND pr.active = true
  )
);

-- Staff can view follow-ups for their practice patients
CREATE POLICY "Staff can view their practice follow-ups"
ON public.patient_follow_ups FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    JOIN public.practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);

-- CREATE POLICIES: INSERT (Create)
-- ============================================================================

-- Doctors can create follow-ups for their practice patients
CREATE POLICY "Doctors can create follow-ups for their patients"
ON public.patient_follow_ups FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = patient_follow_ups.patient_id
    AND pa.practice_id = auth.uid()
  )
);

-- Providers can create follow-ups for their practice patients
CREATE POLICY "Providers can create follow-ups for their patients"
ON public.patient_follow_ups FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    JOIN public.providers pr ON pr.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND pr.user_id = auth.uid()
    AND pr.active = true
  )
);

-- Staff can create follow-ups for their practice patients
CREATE POLICY "Staff can create follow-ups for their patients"
ON public.patient_follow_ups FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    JOIN public.practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);

-- CREATE POLICIES: UPDATE (Edit)
-- ============================================================================

-- Doctors can update follow-ups for their practice patients
CREATE POLICY "Doctors can update their practice follow-ups"
ON public.patient_follow_ups FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = patient_follow_ups.patient_id
    AND pa.practice_id = auth.uid()
  )
);

-- Providers can update follow-ups for their practice patients
CREATE POLICY "Providers can update their practice follow-ups"
ON public.patient_follow_ups FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    JOIN public.providers pr ON pr.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND pr.user_id = auth.uid()
    AND pr.active = true
  )
);

-- Staff can update follow-ups for their practice patients
CREATE POLICY "Staff can update their practice follow-ups"
ON public.patient_follow_ups FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    JOIN public.practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);

-- ============================================================================
-- COMMIT CHANGES
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- After running this migration, verify:
-- 1. Admin can view/edit all patients
-- 2. Doctor can view/edit only their practice patients
-- 3. Provider can view/edit only their practice patients
-- 4. Staff can view/edit only their practice patients
-- 5. Patients can view/edit only their own records
-- 6. All roles can create/update follow-ups for their patients
-- ============================================================================

