-- PHASE 0: Florida Backfill - One-time fix for all existing records
-- This fixes all historical orders and provides clean baseline for migration

-- Backfill patients table
UPDATE patients 
SET address_state = 'FL'
WHERE address_state IS NULL 
  AND (address_formatted IS NOT NULL OR address_street IS NOT NULL OR address IS NOT NULL);

-- Backfill profiles table (covers practices, providers, etc.)
UPDATE profiles 
SET shipping_address_state = 'FL'
WHERE shipping_address_state IS NULL 
  AND (shipping_address_formatted IS NOT NULL OR shipping_address_street IS NOT NULL);

-- Backfill pharmacies table
UPDATE pharmacies 
SET address_state = 'FL'
WHERE address_state IS NULL 
  AND (address IS NOT NULL OR address_street IS NOT NULL);

-- PHASE 1: Add missing address columns to profiles table (for practice addresses)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_formatted TEXT,
ADD COLUMN IF NOT EXISTS address_verification_status TEXT DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS address_verification_source TEXT;

-- Backfill profiles practice addresses with FL state (after columns exist)
UPDATE profiles 
SET address_state = 'FL'
WHERE address_state IS NULL AND address IS NOT NULL;

-- Create trigger to auto-add pharmacy home state to states_serviced array
CREATE OR REPLACE FUNCTION auto_add_pharmacy_home_state()
RETURNS TRIGGER AS $$
BEGIN
  -- If address_state is set and not empty
  IF NEW.address_state IS NOT NULL AND NEW.address_state != '' THEN
    -- If states_serviced is null or empty, initialize with home state
    IF NEW.states_serviced IS NULL OR array_length(NEW.states_serviced, 1) IS NULL THEN
      NEW.states_serviced := ARRAY[NEW.address_state];
    -- If home state not already in states_serviced, add it
    ELSIF NOT (NEW.address_state = ANY(NEW.states_serviced)) THEN
      NEW.states_serviced := array_append(NEW.states_serviced, NEW.address_state);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_pharmacy_home_state
BEFORE INSERT OR UPDATE OF address_state
ON pharmacies
FOR EACH ROW
EXECUTE FUNCTION auto_add_pharmacy_home_state();

-- PHASE 5: Create data validation monitoring view
CREATE VIEW addresses_missing_state AS
SELECT 'patients' as table_name, id, name as record_name, 'address_state' as missing_field
FROM patients 
WHERE (address_formatted IS NOT NULL OR address_street IS NOT NULL) 
  AND address_state IS NULL
UNION ALL
SELECT 'pharmacies', id, name, 'address_state'
FROM pharmacies 
WHERE (address IS NOT NULL OR address_street IS NOT NULL) 
  AND address_state IS NULL
UNION ALL
SELECT 'profiles', id, COALESCE(full_name, email), 'address_state'
FROM profiles 
WHERE address IS NOT NULL AND address_state IS NULL
UNION ALL
SELECT 'profiles', id, COALESCE(full_name, email), 'shipping_address_state'
FROM profiles 
WHERE (shipping_address_formatted IS NOT NULL OR shipping_address_street IS NOT NULL) 
  AND shipping_address_state IS NULL;