-- Create admin user account with credentials
DO $$
DECLARE
  admin_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert admin user into auth.users
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
    email_change_token_new,
    recovery_token
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
    ''
  );

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin');

  -- Profile is created automatically by handle_new_user trigger
  
END $$;