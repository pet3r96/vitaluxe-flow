-- Add timezone column to appointment_settings
ALTER TABLE appointment_settings 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add comment
COMMENT ON COLUMN appointment_settings.timezone IS 'IANA timezone identifier for this practice (e.g., America/New_York, America/Los_Angeles)';
