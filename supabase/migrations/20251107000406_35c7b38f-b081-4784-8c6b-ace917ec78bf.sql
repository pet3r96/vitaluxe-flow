-- Phase 1: Make NPI required for practices

-- Delete pending practices without NPIs (they can't be approved under new rules)
DELETE FROM pending_practices WHERE npi IS NULL;

-- Make NPI required in pending_practices table
ALTER TABLE pending_practices
ALTER COLUMN npi SET NOT NULL;

-- Drop the old constraint that allowed null NPI for non-prescribers
ALTER TABLE pending_practices
DROP CONSTRAINT IF EXISTS check_prescriber_npi;

-- Set has_prescriber to true for all existing practices (becomes redundant now)
UPDATE profiles 
SET has_prescriber = true 
WHERE id IN (
  SELECT user_id FROM user_roles WHERE role = 'doctor'
);

-- Add comment explaining the new logic
COMMENT ON COLUMN profiles.npi IS 
'All practices (doctor role) must have an NPI. RX ordering capability is determined by whether the practice has providers with NPIs, not by the practice NPI itself. Enforced at application layer.';