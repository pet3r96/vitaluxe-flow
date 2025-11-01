-- Restructure vitals system to support single-entry and time-series vitals
-- Add vital_type column to categorize entries
ALTER TABLE patient_vitals ADD COLUMN IF NOT EXISTS vital_type TEXT;

-- Create index for efficient querying by type and date
CREATE INDEX IF NOT EXISTS idx_patient_vitals_type 
  ON patient_vitals(patient_account_id, vital_type, date_recorded DESC);

-- Add partial unique index for height (one per patient)
-- Using unique index instead of constraint to support WHERE clause
CREATE UNIQUE INDEX IF NOT EXISTS unique_patient_height_idx
  ON patient_vitals(patient_account_id)
  WHERE vital_type = 'height';

-- Add partial unique index for weight (one per patient)
CREATE UNIQUE INDEX IF NOT EXISTS unique_patient_weight_idx
  ON patient_vitals(patient_account_id)
  WHERE vital_type = 'weight';

-- Migrate existing data: if records have height, mark them as type 'height'
UPDATE patient_vitals 
SET vital_type = 'height' 
WHERE vital_type IS NULL AND height IS NOT NULL AND weight IS NULL;

-- Migrate existing data: if records have weight, mark them as type 'weight'
UPDATE patient_vitals 
SET vital_type = 'weight' 
WHERE vital_type IS NULL AND weight IS NOT NULL AND height IS NULL;