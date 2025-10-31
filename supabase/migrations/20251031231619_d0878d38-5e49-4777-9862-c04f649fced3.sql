-- ============================================================================
-- FIX TRIGGER AND COMPLETE PATIENT TABLES MERGE
-- This migration fixes the trigger to handle NULL user_id and completes merge
-- ============================================================================

-- Phase 1: Fix the trigger to handle NULL user_id
CREATE OR REPLACE FUNCTION public.sync_patient_account_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync to user_roles if user_id is present (patient has portal access)
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.user_id, 'patient'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Phase 2: Make user_id nullable (allows patients without portal access)
ALTER TABLE public.patient_accounts 
ALTER COLUMN user_id DROP NOT NULL;

-- Add unique constraint on user_id when present
CREATE UNIQUE INDEX IF NOT EXISTS patient_accounts_user_id_unique 
ON public.patient_accounts(user_id) 
WHERE user_id IS NOT NULL;

-- Allow NULL emails for migration
ALTER TABLE public.patient_accounts 
ALTER COLUMN email DROP NOT NULL;

-- Phase 3: Migrate unmapped patients from patients table
INSERT INTO public.patient_accounts (
  id,
  user_id,
  practice_id,
  first_name,
  last_name,
  name,
  email,
  phone,
  date_of_birth,
  birth_date,
  address,
  address_street,
  address_city,
  address_state,
  address_zip,
  address_formatted,
  allergies,
  notes,
  address_verification_status,
  address_verification_source,
  status,
  created_at,
  updated_at
)
SELECT 
  p.id,
  NULL as user_id,
  p.practice_id,
  COALESCE(NULLIF(SPLIT_PART(p.name, ' ', 1), ''), p.name) as first_name,
  NULLIF(SPLIT_PART(p.name, ' ', 2), '') as last_name,
  p.name,
  p.email,
  p.phone,
  p.birth_date as date_of_birth,
  p.birth_date,
  p.address,
  p.address_street,
  p.address_city,
  p.address_state,
  p.address_zip,
  p.address_formatted,
  p.allergies,
  p.notes,
  p.address_verification_status,
  p.address_verification_source,
  'active' as status,
  p.created_at,
  p.updated_at
FROM patients p
WHERE p.patient_account_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Update mapping in patients table for tracking
UPDATE patients p
SET patient_account_id = p.id
WHERE p.patient_account_id IS NULL;

-- Phase 4: Make patients table read-only (deprecation safety)
CREATE OR REPLACE RULE patients_insert_readonly AS 
ON INSERT TO patients 
DO INSTEAD NOTHING;

CREATE OR REPLACE RULE patients_update_readonly AS 
ON UPDATE TO patients 
DO INSTEAD NOTHING;

CREATE OR REPLACE RULE patients_delete_readonly AS 
ON DELETE TO patients 
DO INSTEAD NOTHING;

-- Add deprecation comment
COMMENT ON TABLE public.patients IS 'DEPRECATED - All patient data is now in patient_accounts table. This table is read-only and will be dropped after verification period.';

-- Phase 5: Add comment to patient_accounts to trigger types regeneration
COMMENT ON TABLE public.patient_accounts IS 'Unified patient table - merged from patients and patient_accounts. Supports patients with portal access (user_id NOT NULL) and without portal access (user_id NULL).';