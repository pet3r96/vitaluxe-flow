-- Create a view that automatically decrypts phone numbers for authenticated users
CREATE OR REPLACE VIEW user_2fa_settings_decrypted AS
SELECT 
  id,
  user_id,
  ghl_enabled,
  ghl_phone_verified,
  phone_verified,
  is_enrolled,
  last_ghl_verification,
  created_at,
  updated_at,
  CASE 
    WHEN phone_number_encrypted IS NOT NULL 
    THEN decrypt_2fa_phone(phone_number_encrypted)
    ELSE NULL
  END as phone_number
FROM user_2fa_settings;

-- Grant access to authenticated users
GRANT SELECT ON user_2fa_settings_decrypted TO authenticated;

-- Add RLS policy for the view
ALTER VIEW user_2fa_settings_decrypted SET (security_invoker = true);