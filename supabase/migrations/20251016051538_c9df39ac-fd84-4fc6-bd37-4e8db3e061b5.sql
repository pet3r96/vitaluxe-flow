-- Drop encryption triggers that are rewriting saves on profiles table
DROP TRIGGER IF EXISTS encrypt_prescriber_credentials_trigger ON public.profiles;
DROP TRIGGER IF EXISTS encrypt_profile_contact_trigger ON public.profiles;

-- Repair data: restore plaintext values from encrypted columns where [ENCRYPTED] appears
UPDATE public.profiles
SET
  npi = CASE 
    WHEN npi = '[ENCRYPTED]' AND npi_encrypted IS NOT NULL 
    THEN NULLIF(public.decrypt_prescriber_credential(npi_encrypted, 'npi'), '[DECRYPTION ERROR]')
    ELSE npi 
  END,
  dea = CASE 
    WHEN dea = '[ENCRYPTED]' AND dea_encrypted IS NOT NULL 
    THEN NULLIF(public.decrypt_prescriber_credential(dea_encrypted, 'dea'), '[DECRYPTION ERROR]')
    ELSE dea 
  END,
  license_number = CASE 
    WHEN license_number = '[ENCRYPTED]' AND license_number_encrypted IS NOT NULL 
    THEN NULLIF(public.decrypt_prescriber_credential(license_number_encrypted, 'license_number'), '[DECRYPTION ERROR]')
    ELSE license_number 
  END,
  email = CASE 
    WHEN email = '[ENCRYPTED]' AND email_encrypted IS NOT NULL 
    THEN NULLIF(public.decrypt_profile_contact(email_encrypted, 'email'), '[DECRYPTION ERROR]')
    ELSE email 
  END,
  phone = CASE 
    WHEN phone = '[ENCRYPTED]' AND phone_encrypted IS NOT NULL 
    THEN NULLIF(public.decrypt_profile_contact(phone_encrypted, 'phone'), '[DECRYPTION ERROR]')
    ELSE phone 
  END,
  address = CASE 
    WHEN address = '[ENCRYPTED]' AND address_encrypted IS NOT NULL 
    THEN NULLIF(public.decrypt_profile_contact(address_encrypted, 'address'), '[DECRYPTION ERROR]')
    ELSE address 
  END
WHERE npi = '[ENCRYPTED]' 
   OR dea = '[ENCRYPTED]' 
   OR license_number = '[ENCRYPTED]' 
   OR email = '[ENCRYPTED]' 
   OR phone = '[ENCRYPTED]' 
   OR address = '[ENCRYPTED]';

-- Safety net: null any remaining [ENCRYPTED] placeholders
UPDATE public.profiles
SET 
  npi = NULLIF(npi, '[ENCRYPTED]'),
  dea = NULLIF(dea, '[ENCRYPTED]'),
  license_number = NULLIF(license_number, '[ENCRYPTED]'),
  email = NULLIF(email, '[ENCRYPTED]'),
  phone = NULLIF(phone, '[ENCRYPTED]'),
  address = NULLIF(address, '[ENCRYPTED]')
WHERE npi = '[ENCRYPTED]' 
   OR dea = '[ENCRYPTED]' 
   OR license_number = '[ENCRYPTED]' 
   OR email = '[ENCRYPTED]' 
   OR phone = '[ENCRYPTED]' 
   OR address = '[ENCRYPTED]';