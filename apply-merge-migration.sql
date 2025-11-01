-- ============================================================================
-- QUICK TEST: Check if tables exist before applying merge migration
-- ============================================================================
-- Run this first to check your database state

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') 
    THEN '✅ patients table EXISTS - Ready for merge'
    ELSE '❌ patients table MISSING - Apply base migrations first'
  END as patients_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patient_accounts') 
    THEN '✅ patient_accounts table EXISTS - Ready for merge'
    ELSE '❌ patient_accounts table MISSING - Apply base migrations first'
  END as patient_accounts_status;

-- If both tables exist, you can proceed with the merge migration
-- Otherwise, apply base migrations first (see LOCAL_TESTING_GUIDE.md)

