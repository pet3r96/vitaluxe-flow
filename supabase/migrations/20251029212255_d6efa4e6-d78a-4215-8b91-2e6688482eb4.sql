-- Create function to sync patient_accounts changes to patients table
CREATE OR REPLACE FUNCTION sync_patient_accounts_to_patients()
RETURNS TRIGGER AS $$
BEGIN
  -- Update matching patient record in patients table
  UPDATE patients
  SET
    name = CONCAT(NEW.first_name, ' ', NEW.last_name),
    email = NEW.email,
    phone = NEW.phone,
    birth_date = NEW.date_of_birth,
    address_street = NEW.address,
    address_city = NEW.city,
    address_state = NEW.state,
    address_zip = NEW.zip_code,
    address_formatted = CASE 
      WHEN NEW.address IS NOT NULL AND NEW.city IS NOT NULL AND NEW.state IS NOT NULL 
      THEN CONCAT(NEW.address, ', ', NEW.city, ', ', NEW.state, ' ', COALESCE(NEW.zip_code, ''))
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE 
    email = NEW.email 
    AND practice_id = NEW.practice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync on patient_accounts updates
DROP TRIGGER IF EXISTS trigger_sync_patient_accounts ON patient_accounts;
CREATE TRIGGER trigger_sync_patient_accounts
  AFTER UPDATE ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_accounts_to_patients();

-- Also create trigger for inserts to handle new patient accounts
DROP TRIGGER IF EXISTS trigger_sync_patient_accounts_insert ON patient_accounts;
CREATE TRIGGER trigger_sync_patient_accounts_insert
  AFTER INSERT ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_accounts_to_patients();