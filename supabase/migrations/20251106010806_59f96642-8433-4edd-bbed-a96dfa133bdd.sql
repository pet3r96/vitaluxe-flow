-- Make license_number nullable in pending_practices for non-prescriber practices
ALTER TABLE pending_practices 
ALTER COLUMN license_number DROP NOT NULL;

-- Drop the old check constraint
ALTER TABLE pending_practices 
DROP CONSTRAINT IF EXISTS check_prescriber_npi;

-- Add updated check constraint: if has_prescriber=true, NPI and license_number must be present
ALTER TABLE pending_practices 
ADD CONSTRAINT check_prescriber_credentials 
CHECK (
  (has_prescriber = true AND npi IS NOT NULL AND license_number IS NOT NULL) OR 
  (has_prescriber = false)
);

COMMENT ON CONSTRAINT check_prescriber_credentials ON pending_practices IS 
'Ensures NPI and license_number are provided when practice has prescribing capability';