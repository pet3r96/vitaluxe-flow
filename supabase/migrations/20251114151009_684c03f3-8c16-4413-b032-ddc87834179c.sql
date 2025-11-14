-- Fix user_2fa_settings_decrypted view to include ALL columns
-- This ensures AuthContext can properly detect if users already have 2FA enrolled

DROP VIEW IF EXISTS user_2fa_settings_decrypted;

CREATE VIEW user_2fa_settings_decrypted AS
SELECT 
  id,
  user_id,
  pgp_sym_decrypt(phone_number::bytea, current_setting('app.settings.encryption_key', true))::text as phone_number,
  phone_verified,
  is_enrolled,
  twilio_enabled,
  twilio_phone_verified,
  last_twilio_verification,
  ghl_enabled,
  ghl_phone_verified,
  last_ghl_verification,
  enrolled_at,
  phone_verified_at,
  last_verified_at,
  reset_at,
  reset_requested_by,
  created_at,
  updated_at
FROM user_2fa_settings;