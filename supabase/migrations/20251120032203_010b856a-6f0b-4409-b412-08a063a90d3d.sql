-- ============================================================================
-- MEDICAL VAULT OVERHAUL - COMPREHENSIVE MIGRATION
-- ============================================================================
-- This migration implements:
-- 1. Soft delete support (active column)
-- 2. Practice ID denormalization for RLS performance
-- 3. Enhanced audit logging with before/after values
-- 4. Complete RLS policies for patient vs provider permissions
-- 5. Auto-sync trigger for practice_id

-- ============================================================================
-- PART 1: Add columns to patient_medical_vault
-- ============================================================================

-- Add active column (soft delete flag)
ALTER TABLE public.patient_medical_vault
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Add practice_id for RLS performance
ALTER TABLE public.patient_medical_vault
ADD COLUMN IF NOT EXISTS practice_id UUID;

-- Backfill practice_id from patient_accounts
UPDATE public.patient_medical_vault pmv
SET practice_id = pa.practice_id
FROM patient_accounts pa
WHERE pmv.patient_account_id = pa.id
  AND pmv.practice_id IS NULL;

-- Make practice_id NOT NULL after backfill
ALTER TABLE public.patient_medical_vault
ALTER COLUMN practice_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.patient_medical_vault
ADD CONSTRAINT fk_patient_medical_vault_practice
FOREIGN KEY (practice_id) REFERENCES profiles(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_medical_vault_active 
ON public.patient_medical_vault(patient_account_id, active);

CREATE INDEX IF NOT EXISTS idx_patient_medical_vault_practice 
ON public.patient_medical_vault(practice_id, active);

-- Add comment
COMMENT ON COLUMN public.patient_medical_vault.active IS 
'Soft delete flag. Patients can only set to false (soft delete). Practice team can hard delete.';

-- ============================================================================
-- PART 2: Enhance medical_vault_audit_logs
-- ============================================================================

-- Add practice_id for filtering
ALTER TABLE public.medical_vault_audit_logs
ADD COLUMN IF NOT EXISTS practice_id UUID;

-- Add detailed change tracking
ALTER TABLE public.medical_vault_audit_logs
ADD COLUMN IF NOT EXISTS performed_by_user_id UUID;

ALTER TABLE public.medical_vault_audit_logs
ADD COLUMN IF NOT EXISTS previous_values JSONB;

ALTER TABLE public.medical_vault_audit_logs
ADD COLUMN IF NOT EXISTS new_values JSONB;

-- Backfill practice_id from patient_accounts
UPDATE public.medical_vault_audit_logs mal
SET practice_id = pa.practice_id
FROM patient_accounts pa
WHERE mal.patient_account_id = pa.id
  AND mal.practice_id IS NULL;

-- Make practice_id NOT NULL after backfill
ALTER TABLE public.medical_vault_audit_logs
ALTER COLUMN practice_id SET NOT NULL;

-- Add foreign key
ALTER TABLE public.medical_vault_audit_logs
ADD CONSTRAINT fk_medical_vault_audit_logs_practice
FOREIGN KEY (practice_id) REFERENCES profiles(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_medical_vault_audit_logs_practice 
ON public.medical_vault_audit_logs(practice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_vault_audit_logs_performed_by 
ON public.medical_vault_audit_logs(performed_by_user_id);

-- ============================================================================
-- PART 3: Replace RLS Policies for patient_medical_vault
-- ============================================================================

-- Drop existing incomplete policies
DROP POLICY IF EXISTS "Patients can view their own medical vault" ON public.patient_medical_vault;
DROP POLICY IF EXISTS "Providers can view their practice patients' vault" ON public.patient_medical_vault;
DROP POLICY IF EXISTS "vault_select_practice_staff" ON public.patient_medical_vault;
DROP POLICY IF EXISTS "vault_insert" ON public.patient_medical_vault;
DROP POLICY IF EXISTS "vault_update" ON public.patient_medical_vault;

-- ✅ PATIENT POLICIES (SELECT + INSERT + UPDATE + SOFT DELETE ONLY)

-- Patients can SELECT only active=true records
CREATE POLICY "patients_select_own_active_vault"
ON public.patient_medical_vault
FOR SELECT
TO authenticated
USING (
  patient_account_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
  AND active = true
);

-- Patients can INSERT their own records
CREATE POLICY "patients_insert_own_vault"
ON public.patient_medical_vault
FOR INSERT
TO authenticated
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
);

-- Patients can UPDATE their own records (including soft delete)
CREATE POLICY "patients_update_own_vault"
ON public.patient_medical_vault
FOR UPDATE
TO authenticated
USING (
  patient_account_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
);

-- ❌ NO DELETE POLICY FOR PATIENTS (cannot hard delete)

-- ✅ PRACTICE TEAM POLICIES (FULL ACCESS)

-- Providers & Staff can SELECT all records (active + inactive)
CREATE POLICY "practice_team_select_vault"
ON public.patient_medical_vault
FOR SELECT
TO authenticated
USING (
  practice_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = patient_medical_vault.practice_id
      AND p.active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = patient_medical_vault.practice_id
      AND ps.active = true
  )
);

-- Practice team can INSERT/UPDATE/DELETE (full permissions)
CREATE POLICY "practice_team_insert_vault"
ON public.patient_medical_vault
FOR INSERT
TO authenticated
WITH CHECK (
  practice_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = patient_medical_vault.practice_id
      AND p.active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = patient_medical_vault.practice_id
      AND ps.active = true
  )
);

CREATE POLICY "practice_team_update_vault"
ON public.patient_medical_vault
FOR UPDATE
TO authenticated
USING (
  practice_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = patient_medical_vault.practice_id
      AND p.active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = patient_medical_vault.practice_id
      AND ps.active = true
  )
);

CREATE POLICY "practice_team_delete_vault"
ON public.patient_medical_vault
FOR DELETE
TO authenticated
USING (
  practice_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = patient_medical_vault.practice_id
      AND p.active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = patient_medical_vault.practice_id
      AND ps.active = true
  )
);

-- ============================================================================
-- PART 4: Replace RLS Policies for medical_vault_audit_logs
-- ============================================================================

-- Drop existing incomplete policies
DROP POLICY IF EXISTS "Patients view own audit logs" ON public.medical_vault_audit_logs;
DROP POLICY IF EXISTS "Staff view practice patient audit logs" ON public.medical_vault_audit_logs;
DROP POLICY IF EXISTS "vault_audit_insert" ON public.medical_vault_audit_logs;

-- ✅ PATIENT AUDIT POLICIES

-- Patients can SELECT their own audit logs
CREATE POLICY "patients_select_own_audit_logs"
ON public.medical_vault_audit_logs
FOR SELECT
TO authenticated
USING (
  patient_account_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
);

-- Patients can INSERT logs for their own actions
CREATE POLICY "patients_insert_own_audit_logs"
ON public.medical_vault_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
);

-- ✅ PRACTICE TEAM AUDIT POLICIES

-- Practice team can SELECT all audit logs for their patients
CREATE POLICY "practice_team_select_audit_logs"
ON public.medical_vault_audit_logs
FOR SELECT
TO authenticated
USING (
  practice_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = medical_vault_audit_logs.practice_id
      AND p.active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = medical_vault_audit_logs.practice_id
      AND ps.active = true
  )
);

-- Practice team can INSERT audit logs for any patient in their practice
CREATE POLICY "practice_team_insert_audit_logs"
ON public.medical_vault_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  practice_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = medical_vault_audit_logs.practice_id
  )
  OR
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = medical_vault_audit_logs.practice_id
  )
);

-- ============================================================================
-- PART 5: Auto-sync trigger for practice_id
-- ============================================================================

-- Trigger function to auto-set practice_id on insert
CREATE OR REPLACE FUNCTION sync_vault_practice_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate practice_id from patient_accounts
  SELECT practice_id INTO NEW.practice_id
  FROM patient_accounts
  WHERE id = NEW.patient_account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS set_vault_practice_id ON public.patient_medical_vault;
CREATE TRIGGER set_vault_practice_id
BEFORE INSERT ON public.patient_medical_vault
FOR EACH ROW
WHEN (NEW.practice_id IS NULL)
EXECUTE FUNCTION sync_vault_practice_id();