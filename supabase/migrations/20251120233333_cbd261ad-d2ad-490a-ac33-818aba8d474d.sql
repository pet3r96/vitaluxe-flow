-- Fix user_2fa_settings_decrypted view to properly decrypt phone numbers
DROP VIEW IF EXISTS user_2fa_settings_decrypted;

-- Recreate the view with proper decryption
CREATE VIEW user_2fa_settings_decrypted 
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  CASE 
    WHEN phone_number_encrypted IS NOT NULL AND phone_number_encrypted != '' THEN
      pgp_sym_decrypt(
        phone_number_encrypted::bytea,
        current_setting('app.settings.encryption_key', true)
      )
    ELSE phone_number
  END AS phone_number,
  phone_verified,
  phone_verified_at,
  is_enrolled,
  enrolled_at,
  last_verified_at,
  reset_requested_by,
  reset_at,
  ghl_enabled,
  last_ghl_verification,
  ghl_phone_verified,
  twilio_enabled,
  twilio_phone_verified,
  last_twilio_verification,
  created_at,
  updated_at
FROM user_2fa_settings
WHERE user_id = auth.uid();

-- Grant access to authenticated users
GRANT SELECT ON user_2fa_settings_decrypted TO authenticated;