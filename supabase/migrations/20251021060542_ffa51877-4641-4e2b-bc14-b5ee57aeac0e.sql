-- Fix create_user_with_role to prevent topline reps from having associations
CREATE OR REPLACE FUNCTION public.create_user_with_role(p_user_id uuid, p_email text, p_name text, p_role app_role, p_role_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_rep_id uuid;
  v_parent_id uuid;
  v_states_serviced text[];
BEGIN
  -- Insert or update profile (idempotent)
  INSERT INTO public.profiles (id, name, email, active)
  VALUES (p_user_id, p_name, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    active = EXCLUDED.active,
    updated_at = now()
  RETURNING id INTO v_profile_id;

  -- Insert user role (skip if exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

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

  ELSIF p_role = 'topline' THEN
    -- Topline reps should NEVER have an assigned_topline_id
    INSERT INTO public.reps (user_id, role, assigned_topline_id)
    VALUES (p_user_id, p_role, NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      role = EXCLUDED.role,
      assigned_topline_id = NULL,
      updated_at = now()
    RETURNING id INTO v_rep_id;

  ELSIF p_role = 'downline' THEN
    -- Downline reps MUST have an assigned_topline_id from parentId
    IF p_role_data ? 'parentId' THEN
      v_parent_id := (p_role_data->>'parentId')::uuid;
    END IF;

    INSERT INTO public.reps (user_id, role, assigned_topline_id)
    VALUES (p_user_id, p_role, v_parent_id)
    ON CONFLICT (user_id) DO UPDATE SET
      role = EXCLUDED.role,
      assigned_topline_id = EXCLUDED.assigned_topline_id,
      updated_at = now()
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
    )
    ON CONFLICT (user_id) DO UPDATE SET
      practice_id = EXCLUDED.practice_id,
      npi = EXCLUDED.npi,
      dea = EXCLUDED.dea,
      license_number = EXCLUDED.license_number,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'rep_id', v_rep_id
  );
END;
$function$;