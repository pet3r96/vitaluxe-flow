-- Remove the incorrectly created admin user
DELETE FROM public.user_roles 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'admin@vitaluxeservice.com'
);

DELETE FROM public.profiles 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@vitaluxeservice.com'
);

DELETE FROM auth.users WHERE email = 'admin@vitaluxeservice.com';

-- Create admin user properly with all required fields
DO $$
DECLARE
  admin_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert admin user with all required fields properly set
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    last_sign_in_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  ) VALUES (
    admin_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@vitaluxeservice.com',
    crypt('admin1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Admin User"}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    '',
    NULL,
    NULL,
    NULL,
    '',
    '',
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL,
    false
  );

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin');

  -- Profile will be created automatically by trigger
  
END $$;