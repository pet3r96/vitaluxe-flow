-- Fix user_2fa_settings_decrypted view to include all required columns
DROP VIEW IF EXISTS public.user_2fa_settings_decrypted CASCADE;
CREATE VIEW public.user_2fa_settings_decrypted
WITH (security_invoker=true) AS
SELECT 
  id,
  user_id,
  phone_number,
  phone_verified,
  phone_verified_at,
  is_enrolled,
  enrolled_at,
  last_verified_at,
  ghl_enabled,
  last_ghl_verification,
  ghl_phone_verified,
  twilio_enabled,
  twilio_phone_verified,
  last_twilio_verification,
  phone_number_encrypted,
  created_at,
  updated_at
FROM user_2fa_settings;