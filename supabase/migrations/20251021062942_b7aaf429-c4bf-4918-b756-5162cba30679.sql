-- Update admin email from admin@vitaluxeservice.com to info@vitaluxeservices.com
-- This updates the auth.users table (profiles is already correct)

DO $$
DECLARE
  admin_user_id UUID := '28807c7e-5296-4860-b3a1-93c883dff39d';
BEGIN
  -- Update email in auth.users
  UPDATE auth.users
  SET 
    email = 'info@vitaluxeservices.com',
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{email}',
      '"info@vitaluxeservices.com"'
    ),
    updated_at = now()
  WHERE id = admin_user_id;

  -- Ensure profiles table is also updated (should already be correct)
  UPDATE public.profiles
  SET 
    email = 'info@vitaluxeservices.com',
    updated_at = now()
  WHERE id = admin_user_id;

  RAISE NOTICE 'Admin email updated successfully from admin@vitaluxeservice.com to info@vitaluxeservices.com';
END $$;