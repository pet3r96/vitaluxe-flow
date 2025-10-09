-- Add parent_id to profiles for hierarchy tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_parent_id ON public.profiles(parent_id);

-- Add parent_id to pharmacies for consistency
ALTER TABLE public.pharmacies 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_pharmacies_parent_id ON public.pharmacies(parent_id);

-- Update profiles to ensure all users have proper active status
UPDATE public.profiles 
SET active = COALESCE(active, true) 
WHERE active IS NULL;

-- Create a function to handle atomic user creation with role assignment
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_role app_role,
  p_parent_id uuid DEFAULT NULL,
  p_role_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Insert/Update profile
  INSERT INTO public.profiles (id, name, email, parent_id, active)
  VALUES (p_user_id, p_name, p_email, p_parent_id, true)
  ON CONFLICT (id) DO UPDATE 
  SET name = EXCLUDED.name,
      email = EXCLUDED.email,
      parent_id = EXCLUDED.parent_id,
      updated_at = now();

  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Insert into role-specific table if pharmacy
  IF p_role = 'pharmacy' THEN
    INSERT INTO public.pharmacies (
      user_id, 
      parent_id,
      name, 
      contact_email, 
      address, 
      states_serviced,
      active
    )
    VALUES (
      p_user_id,
      p_parent_id,
      p_name,
      COALESCE(p_role_data->>'contactEmail', p_email),
      p_role_data->>'address',
      COALESCE((p_role_data->'statesServiced')::text[]::text[], ARRAY[]::text[]),
      true
    )
    ON CONFLICT (user_id) DO UPDATE
    SET name = EXCLUDED.name,
        contact_email = EXCLUDED.contact_email,
        address = EXCLUDED.address,
        states_serviced = EXCLUDED.states_serviced,
        updated_at = now();
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'role', p_role
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_user_with_role TO service_role;