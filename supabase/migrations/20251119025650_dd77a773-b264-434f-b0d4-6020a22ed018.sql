-- PHASE 2 SECURITY LOCKDOWN: Complete Database Fixes (Idempotent Version)
-- This migration adds all missing normalization triggers, fixes legacy data, and resolves linter warnings

-- ==========================================
-- SECTION 1: Email Normalization Triggers
-- ==========================================

-- Drop existing triggers if they exist, then recreate
DROP TRIGGER IF EXISTS trigger_normalize_email_profiles ON profiles;
DROP TRIGGER IF EXISTS trigger_normalize_email_patient_accounts ON patient_accounts;

-- Add email normalization trigger to profiles
CREATE TRIGGER trigger_normalize_email_profiles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_email();

-- Add email normalization trigger to patient_accounts
CREATE TRIGGER trigger_normalize_email_patient_accounts
  BEFORE INSERT OR UPDATE ON patient_accounts
  FOR EACH ROW EXECUTE FUNCTION normalize_email();

-- Create unique indexes on lowercase emails
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique 
ON profiles (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS patient_accounts_email_lower_unique 
ON patient_accounts (LOWER(email));

-- ==========================================
-- SECTION 2: Phone Normalization Triggers
-- ==========================================

-- Drop existing triggers if they exist, then recreate
DROP TRIGGER IF EXISTS trigger_normalize_phone_profiles ON profiles;
DROP TRIGGER IF EXISTS trigger_normalize_phone_patient_accounts ON patient_accounts;
DROP TRIGGER IF EXISTS trigger_normalize_phone_pharmacies ON pharmacies;

-- Add phone normalization trigger to profiles
CREATE TRIGGER trigger_normalize_phone_profiles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_normalize_phone();

-- Add phone normalization trigger to patient_accounts
CREATE TRIGGER trigger_normalize_phone_patient_accounts
  BEFORE INSERT OR UPDATE ON patient_accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_normalize_phone();

-- Add phone normalization trigger to pharmacies
CREATE TRIGGER trigger_normalize_phone_pharmacies
  BEFORE INSERT OR UPDATE ON pharmacies
  FOR EACH ROW EXECUTE FUNCTION trigger_normalize_phone();

-- ==========================================
-- SECTION 3: Fix Legacy Phone Data
-- ==========================================

-- Fix empty string and non-E.164 phone numbers in profiles
UPDATE profiles 
SET phone = NULL 
WHERE phone = '' OR (phone IS NOT NULL AND phone NOT LIKE '+%');

-- Fix empty string and non-E.164 phone numbers in patient_accounts
UPDATE patient_accounts 
SET phone = NULL 
WHERE phone = '' OR (phone IS NOT NULL AND phone NOT LIKE '+%');

-- ==========================================
-- SECTION 4: Fix Security Linter Warnings
-- ==========================================

-- Set search_path on all SECURITY DEFINER functions to resolve linter warnings
DO $$
DECLARE
    func_record RECORD;
    func_count INT := 0;
BEGIN
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND NOT EXISTS (
            SELECT 1 
            FROM unnest(p.proconfig) cfg 
            WHERE cfg LIKE 'search_path=%'
          )
    LOOP
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET search_path TO ''public''',
            func_record.function_name,
            func_record.arguments
        );
        func_count := func_count + 1;
        RAISE NOTICE 'Fixed search_path for function #%: %.%(%)', func_count, 'public', func_record.function_name, func_record.arguments;
    END LOOP;
    
    RAISE NOTICE 'PHASE 2: Fixed search_path on % SECURITY DEFINER functions', func_count;
END $$;