-- Fix phone normalization trigger to store 10 digits instead of E.164 format
-- This resolves conflict with phone_format_check constraint (^\d{10}$)

CREATE OR REPLACE FUNCTION normalize_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    -- Remove all non-digit characters
    NEW.phone = REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
    
    -- Remove leading 1 if present (US country code)
    IF LENGTH(NEW.phone) = 11 AND LEFT(NEW.phone, 1) = '1' THEN
      NEW.phone = SUBSTRING(NEW.phone, 2);
    END IF;
    
    -- Result: exactly 10 digits (or invalid, which CHECK constraint will catch)
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers are already attached to profiles, patient_accounts, and pharmacies tables
-- They will automatically use the updated function definition