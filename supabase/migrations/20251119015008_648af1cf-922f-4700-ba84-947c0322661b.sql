-- =====================================================
-- Phase 1 Security Lockdown: Corrective RLS Migration
-- Drop old vulnerable policies, keep new secure ones
-- =====================================================

-- =========================================
-- FIX 1: sms_codes table
-- Remove 4 old policies with 'public' role
-- =========================================

-- Drop old public-role policies that allow unauthenticated access
DROP POLICY IF EXISTS "System can insert SMS codes" ON public.sms_codes;
DROP POLICY IF EXISTS "System can update SMS codes" ON public.sms_codes;
DROP POLICY IF EXISTS "Admins can view all SMS codes" ON public.sms_codes;
DROP POLICY IF EXISTS "Users can view their own SMS codes" ON public.sms_codes;

-- =========================================
-- FIX 2: pharmacy_order_jobs table  
-- Remove 2 old overly-permissive policies
-- =========================================

-- Drop the critical "all authenticated users can do everything" policy
DROP POLICY IF EXISTS "System can manage pharmacy order jobs" ON public.pharmacy_order_jobs;

-- Drop the old admin policy (replaced by pharmacy_jobs_admin_all which properly checks user_roles)
DROP POLICY IF EXISTS "Admins can view all pharmacy order jobs" ON public.pharmacy_order_jobs;

-- =========================================
-- VERIFICATION QUERIES
-- =========================================

-- Confirm sms_codes policies (should only show 5 secure policies)
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename = 'sms_codes'
    AND policyname NOT IN (
      'sms_codes_insert_own', 
      'sms_codes_update_own', 
      'sms_codes_select_own', 
      'sms_codes_delete_own', 
      'sms_codes_service_role_all'
    );
  
  IF policy_count > 0 THEN
    RAISE WARNING 'Found % unexpected policies on sms_codes table', policy_count;
  ELSE
    RAISE NOTICE 'sms_codes RLS policies successfully cleaned - only 5 secure policies remain';
  END IF;
END $$;

-- Confirm pharmacy_order_jobs policies (should only show 4 secure policies)
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename = 'pharmacy_order_jobs'
    AND policyname NOT IN (
      'pharmacy_jobs_select_assigned',
      'pharmacy_jobs_update_assigned', 
      'pharmacy_jobs_admin_all',
      'pharmacy_jobs_service_role_all'
    );
  
  IF policy_count > 0 THEN
    RAISE WARNING 'Found % unexpected policies on pharmacy_order_jobs table', policy_count;
  ELSE
    RAISE NOTICE 'pharmacy_order_jobs RLS policies successfully cleaned - only 4 secure policies remain';
  END IF;
END $$;