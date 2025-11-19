-- =====================================================
-- PHASE 2 SECURITY LOCKDOWN - WEEK 1: FOUNDATION (FIXED)
-- =====================================================
-- Tasks:
-- 1. Add session_created_at column to user_sessions
-- 2. Email normalization (lowercase, unique indexes, triggers)
-- 3. Phone normalization (E.164, function, triggers)
-- 4. Create is_admin() helper function
-- =====================================================

-- =====================================================
-- TASK 1: Add session_created_at for 8-hour hard timeout
-- =====================================================

ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS session_created_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing records to use created_at as session_created_at
UPDATE user_sessions 
SET session_created_at = created_at 
WHERE session_created_at IS NULL;

-- Create trigger to auto-set session_created_at on insert
CREATE OR REPLACE FUNCTION set_session_created_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.session_created_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_session_created_at ON user_sessions;
CREATE TRIGGER trigger_set_session_created_at
BEFORE INSERT ON user_sessions
FOR EACH ROW
EXECUTE FUNCTION set_session_created_at();

-- =====================================================
-- TASK 2: Email Normalization (CRITICAL for preventing duplicates)
-- =====================================================

-- Step 1: Normalize all existing emails to lowercase trimmed
UPDATE profiles 
SET email = LOWER(TRIM(email)) 
WHERE email IS NOT NULL;

UPDATE patient_accounts 
SET email = LOWER(TRIM(email)) 
WHERE email IS NOT NULL;

-- Step 2: Handle duplicates in patient_accounts (keep the oldest record)
WITH duplicate_emails AS (
  SELECT 
    LOWER(email) as normalized_email,
    MIN(created_at) as first_created
  FROM patient_accounts
  WHERE email IS NOT NULL
  GROUP BY LOWER(email)
  HAVING COUNT(*) > 1
),
records_to_keep AS (
  SELECT pa.id
  FROM patient_accounts pa
  INNER JOIN duplicate_emails de ON LOWER(pa.email) = de.normalized_email
  WHERE pa.created_at = de.first_created
)
DELETE FROM patient_accounts
WHERE id IN (
  SELECT pa.id
  FROM patient_accounts pa
  INNER JOIN duplicate_emails de ON LOWER(pa.email) = de.normalized_email
  WHERE pa.id NOT IN (SELECT id FROM records_to_keep)
);

-- Step 3: Create unique indexes on lowercase email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique
ON profiles (LOWER(email)) 
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS patient_accounts_email_lower_unique
ON patient_accounts (LOWER(email)) 
WHERE email IS NOT NULL;

-- Step 4: Create email normalization trigger
CREATE OR REPLACE FUNCTION normalize_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email = LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles table
DROP TRIGGER IF EXISTS trigger_normalize_email_profiles ON profiles;
CREATE TRIGGER trigger_normalize_email_profiles
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION normalize_email();

-- Apply to patient_accounts table
DROP TRIGGER IF EXISTS trigger_normalize_email_patient_accounts ON patient_accounts;
CREATE TRIGGER trigger_normalize_email_patient_accounts
BEFORE INSERT OR UPDATE ON patient_accounts
FOR EACH ROW
EXECUTE FUNCTION normalize_email();

-- =====================================================
-- TASK 3: Phone Normalization (E.164 Standard)
-- =====================================================

-- Create E.164 phone normalization function
CREATE OR REPLACE FUNCTION normalize_phone(phone_input TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
BEGIN
  -- Return NULL if input is NULL
  IF phone_input IS NULL THEN 
    RETURN NULL; 
  END IF;
  
  -- Remove all non-digit characters except leading +
  cleaned := regexp_replace(phone_input, '[^0-9+]', '', 'g');
  
  -- If no leading +, assume US and add +1
  IF NOT cleaned LIKE '+%' THEN
    cleaned := '+1' || cleaned;
  END IF;
  
  -- Validate E.164 format (+ followed by 1-15 digits)
  IF cleaned !~ '^\+[1-9]\d{1,14}$' THEN
    RAISE EXCEPTION 'Invalid phone number format: %. Expected E.164 format (e.g., +12345678901)', phone_input;
  END IF;
  
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create phone normalization trigger function
CREATE OR REPLACE FUNCTION trigger_normalize_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone = normalize_phone(NEW.phone);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Phone normalization failed for "%": %', NEW.phone, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Apply phone normalization to profiles table
DROP TRIGGER IF EXISTS trigger_normalize_phone_profiles ON profiles;
CREATE TRIGGER trigger_normalize_phone_profiles
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_normalize_phone();

-- Apply phone normalization to patient_accounts table
DROP TRIGGER IF EXISTS trigger_normalize_phone_patient_accounts ON patient_accounts;
CREATE TRIGGER trigger_normalize_phone_patient_accounts
BEFORE INSERT OR UPDATE ON patient_accounts
FOR EACH ROW
EXECUTE FUNCTION trigger_normalize_phone();

-- Apply phone normalization to pharmacies table
DROP TRIGGER IF EXISTS trigger_normalize_phone_pharmacies ON pharmacies;
CREATE TRIGGER trigger_normalize_phone_pharmacies
BEFORE INSERT OR UPDATE ON pharmacies
FOR EACH ROW
EXECUTE FUNCTION trigger_normalize_phone();

-- =====================================================
-- TASK 4: Create is_admin() Helper Function
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id 
      AND role IN ('admin', 'super_admin')
  );
$$;

-- =====================================================
-- VERIFICATION: Confirm Week 1 Foundation Setup
-- =====================================================

DO $$
DECLARE
  session_column_exists BOOLEAN;
  email_trigger_exists BOOLEAN;
  phone_trigger_exists BOOLEAN;
  admin_function_exists BOOLEAN;
  duplicate_count INTEGER;
BEGIN
  -- Check session_created_at column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'user_sessions' 
      AND column_name = 'session_created_at'
  ) INTO session_column_exists;
  
  -- Check email normalization trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_normalize_email_profiles'
  ) INTO email_trigger_exists;
  
  -- Check phone normalization trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_normalize_phone_profiles'
  ) INTO phone_trigger_exists;
  
  -- Check is_admin function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin'
  ) INTO admin_function_exists;
  
  -- Check for remaining duplicate emails
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT LOWER(email), COUNT(*) 
    FROM patient_accounts 
    WHERE email IS NOT NULL 
    GROUP BY LOWER(email) 
    HAVING COUNT(*) > 1
  ) dups;
  
  IF session_column_exists AND email_trigger_exists AND phone_trigger_exists AND admin_function_exists AND duplicate_count = 0 THEN
    RAISE NOTICE '✓ Phase 2 Week 1 Foundation: All tasks completed successfully';
    RAISE NOTICE '  - session_created_at column added';
    RAISE NOTICE '  - Email normalization enabled (lowercase + unique indexes)';
    RAISE NOTICE '  - Phone normalization enabled (E.164 format)';
    RAISE NOTICE '  - is_admin() helper function created';
    RAISE NOTICE '  - Duplicate emails removed: 0 remaining';
  ELSE
    RAISE WARNING 'Phase 2 Week 1 Foundation incomplete:';
    RAISE WARNING '  - session_created_at: %', session_column_exists;
    RAISE WARNING '  - Email normalization: %', email_trigger_exists;
    RAISE WARNING '  - Phone normalization: %', phone_trigger_exists;
    RAISE WARNING '  - is_admin() function: %', admin_function_exists;
    RAISE WARNING '  - Duplicate emails remaining: %', duplicate_count;
  END IF;
END $$;