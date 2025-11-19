-- =====================================================
-- Phase 1 Security Lockdown: Clean Up discount_codes Duplicate Policies
-- =====================================================

-- Drop old duplicate policies with less secure or redundant logic
DROP POLICY IF EXISTS "Admins can manage all discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Anyone can view active discount codes" ON public.discount_codes;

-- =========================================
-- VERIFICATION: Confirm only 3 secure policies remain
-- =========================================

DO $$
DECLARE
  policy_count INTEGER;
  expected_policies TEXT[] := ARRAY[
    'discount_codes_admin_all',
    'discount_codes_select_authenticated',
    'discount_codes_service_role_all'
  ];
  actual_policies TEXT[];
BEGIN
  -- Get actual policy names
  SELECT ARRAY_AGG(policyname ORDER BY policyname) INTO actual_policies
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename = 'discount_codes';
  
  -- Count total policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename = 'discount_codes';
  
  IF policy_count = 3 AND actual_policies = expected_policies THEN
    RAISE NOTICE '✓ discount_codes RLS policies successfully cleaned - only 3 secure policies remain';
  ELSE
    RAISE WARNING 'discount_codes has % policies. Expected 3. Policies: %', policy_count, actual_policies;
  END IF;
END $$;