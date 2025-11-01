-- ============================================================================
-- MERGE patient_accounts AND patients TABLES
-- ============================================================================
-- This migration merges the patients table into patient_accounts to create
-- a unified patient data model. Patients without portal access will have
-- user_id = NULL.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Extend patient_accounts table schema
-- ============================================================================

-- Make user_id nullable (allows patients without portal access)
ALTER TABLE public.patient_accounts 
ALTER COLUMN user_id DROP NOT NULL;

-- Drop unique constraint on user_id temporarily (will re-add later with NULL handling)
ALTER TABLE public.patient_accounts 
DROP CONSTRAINT IF EXISTS patient_accounts_user_id_key;

-- Add missing columns from patients table
ALTER TABLE public.patient_accounts
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_formatted TEXT,
ADD COLUMN IF NOT EXISTS address_verification_status TEXT DEFAULT 'unverified' CHECK (address_verification_status IN ('verified', 'invalid', 'manual', 'unverified')),
ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS address_verification_source TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS allergies_encrypted TEXT,
ADD COLUMN IF NOT EXISTS notes_encrypted TEXT,
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES auth.users(id);

-- Ensure practice_id is NOT NULL (should already be, but enforce it)
ALTER TABLE public.patient_accounts
ALTER COLUMN practice_id SET NOT NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_patient_accounts_provider_id ON public.patient_accounts(provider_id);
CREATE INDEX IF NOT EXISTS idx_patient_accounts_address_verification ON public.patient_accounts(address_verification_status) WHERE address_verification_status != 'verified';

-- ============================================================================
-- STEP 2: Create temporary mapping table for patient ID migration
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS patient_id_mapping (
  old_patient_id UUID,
  new_patient_account_id UUID
);

-- ============================================================================
-- STEP 3: Data migration from patients to patient_accounts
-- ============================================================================

-- For each row in patients table:
-- 1. If matching patient_account exists (by email + practice_id): Update it
-- 2. If no matching patient_account: Insert new row with user_id = NULL

DO $$
DECLARE
  patient_record RECORD;
  matched_account_id UUID;
  new_account_id UUID;
  first_name_part TEXT;
  last_name_part TEXT;
BEGIN
  FOR patient_record IN 
    SELECT * FROM public.patients
  LOOP
    -- Try to find matching patient_account by email + practice_id
    SELECT id INTO matched_account_id
    FROM public.patient_accounts
    WHERE email = patient_record.email
      AND practice_id = patient_record.practice_id
    LIMIT 1;

    IF matched_account_id IS NOT NULL THEN
      -- Update existing patient_account with missing fields
      UPDATE public.patient_accounts
      SET
        name = COALESCE(name, patient_record.name),
        address = COALESCE(address, patient_record.address),
        address_street = COALESCE(address_street, patient_record.address_street),
        address_city = COALESCE(address_city, patient_record.address_city),
        address_state = COALESCE(address_state, patient_record.address_state),
        address_zip = COALESCE(address_zip, patient_record.address_zip),
        address_formatted = COALESCE(address_formatted, patient_record.address_formatted),
        address_verification_status = COALESCE(address_verification_status, patient_record.address_verification_status, 'unverified'),
        address_verified_at = COALESCE(address_verified_at, patient_record.address_verified_at),
        address_verification_source = COALESCE(address_verification_source, patient_record.address_verification_source),
        birth_date = COALESCE(birth_date, date_of_birth, patient_record.birth_date),
        date_of_birth = COALESCE(date_of_birth, patient_record.birth_date),
        allergies = COALESCE(allergies, patient_record.allergies),
        notes = COALESCE(notes, patient_record.notes),
        allergies_encrypted = COALESCE(allergies_encrypted, patient_record.allergies_encrypted),
        notes_encrypted = COALESCE(notes_encrypted, patient_record.notes_encrypted),
        provider_id = COALESCE(provider_id, patient_record.provider_id),
        phone = COALESCE(phone, patient_record.phone),
        updated_at = now()
      WHERE id = matched_account_id;

      -- Store mapping
      INSERT INTO patient_id_mapping (old_patient_id, new_patient_account_id)
      VALUES (patient_record.id, matched_account_id)
      ON CONFLICT DO NOTHING;
    ELSE
      -- No matching patient_account found, create new one
      -- Split name into first_name/last_name if not already set
      IF patient_record.name IS NOT NULL THEN
        first_name_part := TRIM(SPLIT_PART(patient_record.name, ' ', 1));
        last_name_part := TRIM(SUBSTRING(patient_record.name FROM LENGTH(first_name_part) + 2));
        IF last_name_part = '' THEN
          last_name_part := NULL;
        END IF;
      END IF;

      -- Insert new patient_account
      INSERT INTO public.patient_accounts (
        id,
        user_id,  -- NULL for patients without portal access
        practice_id,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        birth_date,
        name,
        address,
        address_street,
        address_city,
        address_state,
        address_zip,
        address_formatted,
        address_verification_status,
        address_verified_at,
        address_verification_source,
        allergies,
        notes,
        allergies_encrypted,
        notes_encrypted,
        provider_id,
        status,
        created_at,
        updated_at
      )
      VALUES (
        patient_record.id,  -- Use patients.id as patient_accounts.id
        NULL,  -- No portal access yet
        patient_record.practice_id,
        COALESCE(first_name_part, 'Unknown'),
        COALESCE(last_name_part, ''),
        patient_record.email,
        patient_record.phone,
        patient_record.birth_date,
        patient_record.birth_date,
        patient_record.name,
        patient_record.address,
        patient_record.address_street,
        patient_record.address_city,
        patient_record.address_state,
        patient_record.address_zip,
        patient_record.address_formatted,
        COALESCE(patient_record.address_verification_status, 'unverified'),
        patient_record.address_verified_at,
        patient_record.address_verification_source,
        patient_record.allergies,
        patient_record.notes,
        patient_record.allergies_encrypted,
        patient_record.notes_encrypted,
        patient_record.provider_id,
        'active',
        patient_record.created_at,
        patient_record.updated_at
      )
      RETURNING id INTO new_account_id;

      -- Store mapping (should be same as patient_record.id)
      INSERT INTO patient_id_mapping (old_patient_id, new_patient_account_id)
      VALUES (patient_record.id, COALESCE(new_account_id, patient_record.id))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Update foreign key references from patients to patient_accounts
-- ============================================================================

-- Update cart_lines.patient_id foreign key
ALTER TABLE public.cart_lines
DROP CONSTRAINT IF EXISTS cart_lines_patient_id_fkey;

ALTER TABLE public.cart_lines
ADD CONSTRAINT cart_lines_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES public.patient_accounts(id) ON DELETE SET NULL;

-- Update order_lines.patient_id foreign key
ALTER TABLE public.order_lines
DROP CONSTRAINT IF EXISTS order_lines_patient_id_fkey;

ALTER TABLE public.order_lines
ADD CONSTRAINT order_lines_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES public.patient_accounts(id) ON DELETE SET NULL;

-- Update provider_document_patients.patient_id foreign key
ALTER TABLE public.provider_document_patients
DROP CONSTRAINT IF EXISTS provider_document_patients_patient_id_fkey;

ALTER TABLE public.provider_document_patients
ADD CONSTRAINT provider_document_patients_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES public.patient_accounts(id) ON DELETE CASCADE;

-- Check for any other tables referencing patients.id
-- (These may need to be updated if they exist)
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'patients'
      AND ccu.column_name = 'id'
      AND tc.table_name != 'patient_accounts'
      AND tc.table_name NOT IN ('cart_lines', 'order_lines', 'provider_document_patients')  -- Already handled above
  LOOP
    -- Drop old constraint
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      constraint_record.table_name,
      constraint_record.constraint_name
    );
    
    -- Add new constraint pointing to patient_accounts
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.patient_accounts(id) ON DELETE SET NULL',
      constraint_record.table_name,
      constraint_record.constraint_name,
      constraint_record.column_name
    );
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Update RLS policies (consolidate from both tables)
-- ============================================================================

-- Drop existing patient_accounts policies
DROP POLICY IF EXISTS "Admins can manage all patient accounts" ON public.patient_accounts;
DROP POLICY IF EXISTS "Practices can view their patients" ON public.patient_accounts;
DROP POLICY IF EXISTS "Patients can view their own account" ON public.patient_accounts;
DROP POLICY IF EXISTS "Patients can update their own account" ON public.patient_accounts;

-- Create comprehensive RLS policies for merged table

-- SELECT policies
CREATE POLICY "Admins can view all patient accounts"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can view their practice patients"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND practice_id = auth.uid()
);

CREATE POLICY "Providers can view their practice patients"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
  )
);

CREATE POLICY "Patients can view their own account"
ON public.patient_accounts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT policies
CREATE POLICY "Admins can create patient accounts"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND practice_id = auth.uid()
);

CREATE POLICY "Providers can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
  )
);

-- UPDATE policies
CREATE POLICY "Admins can update all patient accounts"
ON public.patient_accounts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

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

CREATE POLICY "Providers can update their practice patients"
ON public.patient_accounts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
  )
);

CREATE POLICY "Patients can update their own account"
ON public.patient_accounts FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- STEP 6: Add unique constraint on user_id (allowing NULLs)
-- ============================================================================

-- Create unique index on user_id that allows multiple NULLs
CREATE UNIQUE INDEX IF NOT EXISTS patient_accounts_user_id_unique_idx
ON public.patient_accounts(user_id)
WHERE user_id IS NOT NULL;

-- ============================================================================
-- STEP 7: Update triggers that reference patients table
-- ============================================================================

-- Drop triggers on patients table (will be recreated on patient_accounts if needed)
DROP TRIGGER IF EXISTS update_patients_updated_at ON public.patients;
DROP TRIGGER IF EXISTS trg_log_patient_access ON public.patients;

-- Ensure patient_accounts has the updated_at trigger (should already exist)
-- Recreate trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_patient_accounts_updated_at'
  ) THEN
    CREATE TRIGGER update_patient_accounts_updated_at
      BEFORE UPDATE ON public.patient_accounts
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Update log_patient_access trigger to work with patient_accounts
CREATE OR REPLACE FUNCTION public.log_patient_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_audit_event(
    TG_OP || '_patient',
    'patient_accounts',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'practice_id', COALESCE(NEW.practice_id, OLD.practice_id),
      'has_phi', (COALESCE(NEW.allergies, OLD.allergies) IS NOT NULL 
                  OR COALESCE(NEW.notes, OLD.notes) IS NOT NULL),
      'has_address', (COALESCE(NEW.address, OLD.address) IS NOT NULL),
      'operation', TG_OP
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate trigger on patient_accounts if the function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_patient_access') THEN
    DROP TRIGGER IF EXISTS trg_log_patient_access ON public.patient_accounts;
    CREATE TRIGGER trg_log_patient_access
    AFTER INSERT OR UPDATE OR DELETE ON public.patient_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.log_patient_access();
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Update views and functions that reference patients table
-- ============================================================================

-- Note: Views and functions will need to be updated in separate migrations
-- if they reference the patients table. The migration will handle basic
-- foreign key updates above.

COMMIT;

