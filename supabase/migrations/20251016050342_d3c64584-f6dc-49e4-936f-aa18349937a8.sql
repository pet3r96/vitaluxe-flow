-- Clean up [ENCRYPTED] placeholders from all tables

-- Clean up profiles table
UPDATE profiles 
SET 
  npi = NULL,
  dea = NULL,
  license_number = NULL
WHERE npi = '[ENCRYPTED]' 
   OR dea = '[ENCRYPTED]' 
   OR license_number = '[ENCRYPTED]';

-- Clean up order_lines table
UPDATE order_lines 
SET 
  prescription_url = NULL,
  custom_dosage = NULL,
  custom_sig = NULL,
  patient_email = NULL,
  patient_phone = NULL,
  patient_address = NULL
WHERE prescription_url = '[ENCRYPTED]'
   OR custom_dosage = '[ENCRYPTED]'
   OR custom_sig = '[ENCRYPTED]'
   OR patient_email = '[ENCRYPTED]'
   OR patient_phone = '[ENCRYPTED]'
   OR patient_address = '[ENCRYPTED]';

-- Clean up cart_lines table
UPDATE cart_lines 
SET 
  prescription_url = NULL,
  custom_dosage = NULL,
  custom_sig = NULL,
  patient_email = NULL,
  patient_phone = NULL,
  patient_address = NULL
WHERE prescription_url = '[ENCRYPTED]'
   OR custom_dosage = '[ENCRYPTED]'
   OR custom_sig = '[ENCRYPTED]'
   OR patient_email = '[ENCRYPTED]'
   OR patient_phone = '[ENCRYPTED]'
   OR patient_address = '[ENCRYPTED]';