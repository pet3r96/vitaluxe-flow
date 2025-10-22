-- Temporary: Allow phone_number to be nullable for debugging
-- This helps identify if the phone number is being sent but failing insertion
ALTER TABLE user_2fa_settings ALTER COLUMN phone_number DROP NOT NULL;

-- Add comment to track this is temporary
COMMENT ON COLUMN user_2fa_settings.phone_number IS 'Temporarily nullable for debugging. Will be made NOT NULL again after issue is resolved.';