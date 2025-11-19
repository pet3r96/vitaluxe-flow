-- =====================================================
-- PHASE 2 FINAL: Part 1 - Normalize Legacy Phone Numbers
-- =====================================================

-- Normalize all legacy phone numbers in profiles
UPDATE profiles 
SET phone = normalize_phone(phone) 
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND phone != '';

-- Normalize all legacy phone numbers in patient_accounts
UPDATE patient_accounts 
SET phone = normalize_phone(phone) 
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND phone != '';

-- Normalize all legacy phone numbers in pharmacies
UPDATE pharmacies 
SET phone = normalize_phone(phone) 
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND phone != '';