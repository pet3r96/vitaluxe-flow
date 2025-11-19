
-- Phase 2: Apply Email/Phone Normalization Triggers (Re-apply)

-- Create normalize_email function
CREATE OR REPLACE FUNCTION normalize_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email = LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

-- Create normalize_phone function (E.164 format)
CREATE OR REPLACE FUNCTION normalize_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    -- Remove all non-digit characters
    NEW.phone = REGEXP_REPLACE(NEW.phone, '[^0-9+]', '', 'g');
    
    -- If it doesn't start with +, add +1 for US numbers
    IF NOT NEW.phone ~ '^\+' THEN
      IF LENGTH(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g')) = 10 THEN
        NEW.phone = '+1' || REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
      ELSIF LENGTH(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g')) = 11 AND LEFT(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g'), 1) = '1' THEN
        NEW.phone = '+' || REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
      ELSE
        NEW.phone = '+' || REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach email normalization trigger to profiles
DROP TRIGGER IF EXISTS trigger_normalize_email_profiles ON profiles;
CREATE TRIGGER trigger_normalize_email_profiles
  BEFORE INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION normalize_email();

-- Attach phone normalization trigger to profiles
DROP TRIGGER IF EXISTS trigger_normalize_phone_profiles ON profiles;
CREATE TRIGGER trigger_normalize_phone_profiles
  BEFORE INSERT OR UPDATE OF phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone();

-- Attach email normalization trigger to patient_accounts
DROP TRIGGER IF EXISTS trigger_normalize_email_patient_accounts ON patient_accounts;
CREATE TRIGGER trigger_normalize_email_patient_accounts
  BEFORE INSERT OR UPDATE OF email ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION normalize_email();

-- Attach phone normalization trigger to patient_accounts
DROP TRIGGER IF EXISTS trigger_normalize_phone_patient_accounts ON patient_accounts;
CREATE TRIGGER trigger_normalize_phone_patient_accounts
  BEFORE INSERT OR UPDATE OF phone ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone();

-- Attach phone normalization trigger to pharmacies
DROP TRIGGER IF EXISTS trigger_normalize_phone_pharmacies ON pharmacies;
CREATE TRIGGER trigger_normalize_phone_pharmacies
  BEFORE INSERT OR UPDATE OF phone ON pharmacies
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone();
