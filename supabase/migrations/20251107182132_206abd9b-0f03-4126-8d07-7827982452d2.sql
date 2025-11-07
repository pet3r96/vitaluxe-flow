-- Phase 1: Add SMS Provider Configuration

-- Add SMS provider setting to system_settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'sms_provider',
  '"twilio"',
  'SMS provider for 2FA: "twilio" or "ghl"'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = '"twilio"',
    description = 'SMS provider for 2FA: "twilio" or "ghl"';

-- Add Twilio tracking columns to user_2fa_settings
ALTER TABLE user_2fa_settings
ADD COLUMN IF NOT EXISTS twilio_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS twilio_phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_twilio_verification TIMESTAMPTZ;

-- Add index for Twilio queries
CREATE INDEX IF NOT EXISTS idx_user_2fa_settings_twilio_enabled 
ON user_2fa_settings(twilio_enabled) 
WHERE twilio_enabled = TRUE;

-- Add comment for clarity
COMMENT ON COLUMN user_2fa_settings.twilio_enabled IS 'Whether Twilio 2FA is enabled for this user';
COMMENT ON COLUMN user_2fa_settings.twilio_phone_verified IS 'Whether phone number is verified via Twilio';
COMMENT ON COLUMN user_2fa_settings.last_twilio_verification IS 'Last time user verified via Twilio';