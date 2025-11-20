-- Fix sync_patient_account_to_profile to match check_single_primary_role logic
-- Only insert 'patient' role if user has no other primary roles (except admin/super_admin)

CREATE OR REPLACE FUNCTION sync_patient_account_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only sync if user_id is not null AND user doesn't have any other primary role
  -- (admin and super_admin are allowed alongside other roles)
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.user_id 
      AND role NOT IN ('admin', 'super_admin')
  ) THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.user_id, 'patient'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Phone standardization - now safe to run

-- Fix profiles
UPDATE profiles
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 10
  AND phone !~ '^\d{10}$';

UPDATE profiles
SET phone = NULL
WHERE phone IS NOT NULL AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) != 10;

-- Fix pharmacies
UPDATE pharmacies
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 10
  AND phone !~ '^\d{10}$';

UPDATE pharmacies
SET phone = NULL
WHERE phone IS NOT NULL AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) != 10;

-- Fix pending_practices
UPDATE pending_practices
SET phone = CASE 
      WHEN phone IS NOT NULL AND phone != '' AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 10
      THEN REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
      WHEN phone IS NOT NULL AND phone != '' AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) != 10
      THEN NULL
      ELSE phone
    END,
    prescriber_phone = CASE 
      WHEN prescriber_phone IS NOT NULL AND prescriber_phone != '' AND LENGTH(REGEXP_REPLACE(prescriber_phone, '[^0-9]', '', 'g')) = 10
      THEN REGEXP_REPLACE(prescriber_phone, '[^0-9]', '', 'g')
      WHEN prescriber_phone IS NOT NULL AND prescriber_phone != '' AND LENGTH(REGEXP_REPLACE(prescriber_phone, '[^0-9]', '', 'g')) != 10
      THEN NULL
      ELSE prescriber_phone
    END;

-- Fix cart_lines
UPDATE cart_lines
SET patient_phone = REGEXP_REPLACE(patient_phone, '[^0-9]', '', 'g')
WHERE patient_phone IS NOT NULL AND patient_phone != ''
  AND LENGTH(REGEXP_REPLACE(patient_phone, '[^0-9]', '', 'g')) = 10
  AND patient_phone !~ '^\d{10}$';

UPDATE cart_lines
SET patient_phone = NULL
WHERE patient_phone IS NOT NULL AND patient_phone != ''
  AND LENGTH(REGEXP_REPLACE(patient_phone, '[^0-9]', '', 'g')) != 10;

-- Fix order_lines
UPDATE order_lines
SET patient_phone = REGEXP_REPLACE(patient_phone, '[^0-9]', '', 'g')
WHERE patient_phone IS NOT NULL AND patient_phone != ''
  AND LENGTH(REGEXP_REPLACE(patient_phone, '[^0-9]', '', 'g')) = 10
  AND patient_phone !~ '^\d{10}$';

UPDATE order_lines
SET patient_phone = NULL
WHERE patient_phone IS NOT NULL AND patient_phone != ''
  AND LENGTH(REGEXP_REPLACE(patient_phone, '[^0-9]', '', 'g')) != 10;

-- Fix patient_accounts
UPDATE patient_accounts
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g'),
    emergency_contact_phone = CASE 
      WHEN emergency_contact_phone IS NOT NULL AND emergency_contact_phone != ''
        AND LENGTH(REGEXP_REPLACE(emergency_contact_phone, '[^0-9]', '', 'g')) = 10
      THEN REGEXP_REPLACE(emergency_contact_phone, '[^0-9]', '', 'g')
      ELSE emergency_contact_phone
    END
WHERE phone IS NOT NULL AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 10
  AND phone !~ '^\d{10}$';

UPDATE patient_accounts
SET phone = NULL,
    emergency_contact_phone = CASE 
      WHEN emergency_contact_phone IS NOT NULL AND emergency_contact_phone != ''
        AND LENGTH(REGEXP_REPLACE(emergency_contact_phone, '[^0-9]', '', 'g')) != 10
      THEN NULL
      ELSE emergency_contact_phone
    END
WHERE phone IS NOT NULL AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) != 10;

UPDATE patient_accounts
SET emergency_contact_phone = NULL
WHERE emergency_contact_phone IS NOT NULL AND emergency_contact_phone != ''
  AND LENGTH(REGEXP_REPLACE(emergency_contact_phone, '[^0-9]', '', 'g')) != 10;

-- Add CHECK constraints
ALTER TABLE profiles 
ADD CONSTRAINT phone_format_check 
CHECK (phone IS NULL OR phone = '' OR phone ~ '^\d{10}$');

ALTER TABLE patient_accounts 
ADD CONSTRAINT phone_format_check 
CHECK (phone IS NULL OR phone = '' OR phone ~ '^\d{10}$');

ALTER TABLE patient_accounts 
ADD CONSTRAINT emergency_phone_format_check 
CHECK (emergency_contact_phone IS NULL OR emergency_contact_phone = '' OR emergency_contact_phone ~ '^\d{10}$');

ALTER TABLE pharmacies 
ADD CONSTRAINT phone_format_check 
CHECK (phone IS NULL OR phone = '' OR phone ~ '^\d{10}$');

ALTER TABLE pending_practices 
ADD CONSTRAINT phone_format_check 
CHECK (phone IS NULL OR phone = '' OR phone ~ '^\d{10}$');

ALTER TABLE pending_practices 
ADD CONSTRAINT prescriber_phone_format_check 
CHECK (prescriber_phone IS NULL OR prescriber_phone = '' OR prescriber_phone ~ '^\d{10}$');

ALTER TABLE cart_lines 
ADD CONSTRAINT patient_phone_format_check 
CHECK (patient_phone IS NULL OR patient_phone = '' OR patient_phone ~ '^\d{10}$');

ALTER TABLE order_lines 
ADD CONSTRAINT patient_phone_format_check 
CHECK (patient_phone IS NULL OR patient_phone = '' OR patient_phone ~ '^\d{10}$');

ALTER TABLE sms_codes 
ADD CONSTRAINT phone_format_check 
CHECK (phone ~ '^\d{10}$');