-- Backfill name field from first_name and last_name for patients with NULL name
UPDATE patient_accounts
SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE name IS NULL 
  AND (first_name IS NOT NULL OR last_name IS NOT NULL)
  AND TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) != '';

-- For patients with NULL name AND NULL first/last names, use email prefix
UPDATE patient_accounts
SET name = SPLIT_PART(email, '@', 1)
WHERE name IS NULL 
  AND email IS NOT NULL
  AND (first_name IS NULL OR TRIM(first_name) = '')
  AND (last_name IS NULL OR TRIM(last_name) = '');

-- Create function to auto-sync name field from first_name and last_name
CREATE OR REPLACE FUNCTION sync_patient_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If name is null or empty, generate from first_name and last_name
  IF NEW.name IS NULL OR TRIM(NEW.name) = '' THEN
    NEW.name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    -- If still empty, use email prefix as fallback
    IF NEW.name IS NULL OR TRIM(NEW.name) = '' THEN
      IF NEW.email IS NOT NULL THEN
        NEW.name := SPLIT_PART(NEW.email, '@', 1);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync name on insert/update
CREATE TRIGGER trg_sync_patient_name
  BEFORE INSERT OR UPDATE OF first_name, last_name, name, email
  ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_name();