-- Add user_id column to pharmacies if it doesn't exist
ALTER TABLE public.pharmacies 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create unique index on user_id if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pharmacies_user_id ON public.pharmacies(user_id);

-- Drop all existing versions of create_user_with_role function
DROP FUNCTION IF EXISTS public.create_user_with_role(uuid, text, text, app_role, jsonb);
DROP FUNCTION IF EXISTS public.create_user_with_role(uuid, text, text, app_role);
DROP FUNCTION IF EXISTS public.create_user_with_role;

-- Create new version with correct JSON to text[] conversion
CREATE FUNCTION public.create_user_with_role(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role app_role,
  p_role_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_rep_id uuid;
  v_parent_id uuid;
  v_states_serviced text[];
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, name, email, active)
  VALUES (p_user_id, p_name, p_email, true)
  RETURNING id INTO v_profile_id;

  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role);

  -- Handle role-specific data
  IF p_role = 'pharmacy' THEN
    -- Convert JSON array to text[] properly
    v_states_serviced := COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          COALESCE(p_role_data->'statesServiced', '[]'::jsonb)
        )
      ),
      ARRAY[]::text[]
    );

    INSERT INTO public.pharmacies (
      id,
      user_id,
      name,
      contact_email,
      address,
      states_serviced,
      priority_map
    ) VALUES (
      gen_random_uuid(),
      p_user_id,
      p_name,
      COALESCE(p_role_data->>'contactEmail', p_email),
      p_role_data->>'address',
      v_states_serviced,
      COALESCE(p_role_data->'priorityMap', '{}'::jsonb)
    )
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      contact_email = EXCLUDED.contact_email,
      address = EXCLUDED.address,
      states_serviced = EXCLUDED.states_serviced,
      priority_map = EXCLUDED.priority_map,
      updated_at = now();

  ELSIF p_role = 'topline' OR p_role = 'downline' THEN
    -- Get parent_id if provided
    IF p_role_data ? 'parentId' THEN
      v_parent_id := (p_role_data->>'parentId')::uuid;
    END IF;

    INSERT INTO public.reps (user_id, role, assigned_topline_id)
    VALUES (p_user_id, p_role, v_parent_id)
    RETURNING id INTO v_rep_id;

  ELSIF p_role = 'provider' THEN
    INSERT INTO public.providers (
      user_id,
      practice_id,
      npi,
      dea,
      license_number
    ) VALUES (
      p_user_id,
      (p_role_data->>'practiceId')::uuid,
      p_role_data->>'npi',
      p_role_data->>'dea',
      p_role_data->>'licenseNumber'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'rep_id', v_rep_id
  );
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.create_user_with_role TO service_role;