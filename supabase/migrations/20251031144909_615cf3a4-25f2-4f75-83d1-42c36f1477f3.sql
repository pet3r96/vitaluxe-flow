-- Drop all triggers and functions that create the bidirectional sync loop
DROP TRIGGER IF EXISTS trigger_sync_patient_accounts ON patient_accounts CASCADE;
DROP TRIGGER IF EXISTS trigger_sync_patient_accounts_insert ON patient_accounts CASCADE;
DROP TRIGGER IF EXISTS trg_sync_patient_accounts_to_patients ON patient_accounts CASCADE;
DROP FUNCTION IF EXISTS sync_patient_accounts_to_patients() CASCADE;

-- Create improved one-way sync trigger function with change detection
CREATE OR REPLACE FUNCTION sync_patient_address_to_account()
RETURNS TRIGGER AS $$
DECLARE
  v_current_address text;
  v_current_city text;
  v_current_state text;
  v_current_zip text;
BEGIN
  -- Only sync if patient_account_id is set
  IF NEW.patient_account_id IS NOT NULL THEN
    -- Check current values in patient_accounts to avoid unnecessary updates
    SELECT address, city, state, zip_code
    INTO v_current_address, v_current_city, v_current_state, v_current_zip
    FROM patient_accounts
    WHERE id = NEW.patient_account_id;
    
    -- Only update if values have actually changed
    IF (COALESCE(v_current_address, '') != COALESCE(NEW.address_street, '')) OR
       (COALESCE(v_current_city, '') != COALESCE(NEW.address_city, '')) OR
       (COALESCE(v_current_state, '') != COALESCE(NEW.address_state, '')) OR
       (COALESCE(v_current_zip, '') != COALESCE(NEW.address_zip, '')) THEN
      
      UPDATE patient_accounts
      SET 
        address = NEW.address_street,
        city = NEW.address_city,
        state = NEW.address_state,
        zip_code = NEW.address_zip,
        updated_at = now()
      WHERE id = NEW.patient_account_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create one-way sync trigger on patients table
DROP TRIGGER IF EXISTS trg_sync_patient_address ON patients;
CREATE TRIGGER trg_sync_patient_address
  AFTER INSERT OR UPDATE OF address_street, address_city, address_state, address_zip
  ON patients
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_address_to_account();

-- Backfill existing patient addresses to patient_accounts
UPDATE patient_accounts pa
SET 
  address = p.address_street,
  city = p.address_city,
  state = p.address_state,
  zip_code = p.address_zip,
  updated_at = now()
FROM patients p
WHERE p.patient_account_id = pa.id
  AND p.address_street IS NOT NULL
  AND (
    COALESCE(pa.address, '') != COALESCE(p.address_street, '')
    OR COALESCE(pa.city, '') != COALESCE(p.address_city, '')
    OR COALESCE(pa.state, '') != COALESCE(p.address_state, '')
    OR COALESCE(pa.zip_code, '') != COALESCE(p.address_zip, '')
  );