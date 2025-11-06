-- Add has_prescriber flag to profiles table
ALTER TABLE profiles 
ADD COLUMN has_prescriber boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN profiles.has_prescriber IS 
'Indicates if practice has prescribing capability. False = can only order non-Rx products';

-- Set existing practices to true (all have NPIs = all have prescribers)
UPDATE profiles 
SET has_prescriber = true 
WHERE npi IS NOT NULL;

-- Add has_prescriber to pending_practices table
ALTER TABLE pending_practices 
ADD COLUMN has_prescriber boolean DEFAULT true NOT NULL;

-- Make NPI nullable in pending_practices (currently NOT NULL)
ALTER TABLE pending_practices 
ALTER COLUMN npi DROP NOT NULL;

-- Add check constraint: if has_prescriber=true, NPI must be present
ALTER TABLE pending_practices 
ADD CONSTRAINT check_prescriber_npi 
CHECK (
  (has_prescriber = true AND npi IS NOT NULL) OR 
  (has_prescriber = false)
);