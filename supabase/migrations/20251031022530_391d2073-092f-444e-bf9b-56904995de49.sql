-- Add preferred_contact_method column to patient_emergency_contacts
ALTER TABLE patient_emergency_contacts 
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT 
DEFAULT 'any' 
CHECK (preferred_contact_method IN ('phone', 'sms', 'email', 'any'));

-- Create index for efficiency
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_method 
ON patient_emergency_contacts(preferred_contact_method);

-- Update existing records to have default value
UPDATE patient_emergency_contacts 
SET preferred_contact_method = 'any' 
WHERE preferred_contact_method IS NULL;