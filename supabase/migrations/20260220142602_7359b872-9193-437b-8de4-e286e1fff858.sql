
-- Update create_user_with_role to skip pharmacies INSERT when isPharmacyStaff flag is set
-- This prevents phantom pharmacy records when adding pharmacy staff members

CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role text,
  p_role_data jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'pending_activation'::text,
  p_temp_password text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
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
  -- Insert or update profile with new fields
  INSERT INTO public.profiles (id, name, email, active, status, verified_at, temp_password, created_by)
  VALUES (
    p_user_id, 
    p_name, 
    p_email, 
    true,
    p_status,
    CASE WHEN p_status = 'active' THEN now() ELSE NULL END,
    p_temp_password,
    p_created_by
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    active = EXCLUDED.active,
    status = EXCLUDED.status,
    verified_at = EXCLUDED.verified_at,
    temp_password = EXCLUDED.temp_password,
    created_by = EXCLUDED.created_by,
    updated_at = now()
  RETURNING id INTO v_profile_id;

  -- Insert user role (skip if exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Handle role-specific data
  -- For pharmacy role, skip pharmacies INSERT if this is a pharmacy staff member
  IF p_role = 'pharmacy' AND NOT COALESCE((p_role_data->>'isPharmacyStaff')::boolean, false) THEN
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
    v_parent_id := NULL;
    
    INSERT INTO public.reps (user_id, role, assigned_topline_id)
    VALUES (p_user_id, p_role, NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      role = EXCLUDED.role,
      assigned_topline_id = NULL,
      updated_at = now()
    RETURNING id INTO v_rep_id;

  ELSIF p_role = 'downline' THEN
    IF p_role_data ? 'linkedToplineId' THEN
      v_parent_id := (p_role_data->>'linkedToplineId')::uuid;
    ELSIF p_role_data ? 'parentId' THEN
      v_parent_id := (p_role_data->>'parentId')::uuid;
    END IF;
    
    IF v_parent_id IS NULL THEN
      RAISE EXCEPTION 'Downline reps must have an assigned topline (linkedToplineId or parentId required)';
    END IF;

    INSERT INTO public.reps (user_id, role, assigned_topline_id)
    VALUES (p_user_id, p_role, v_parent_id)
    ON CONFLICT (user_id) DO UPDATE SET
      role = EXCLUDED.role,
      assigned_topline_id = EXCLUDED.assigned_topline_id,
      updated_at = now()
    RETURNING id INTO v_rep_id;

  ELSIF p_role = 'provider' THEN
    -- Insert provider link
    INSERT INTO public.providers (user_id, practice_id)
    VALUES (p_user_id, (p_role_data->>'practiceId')::uuid)
    ON CONFLICT (user_id) DO UPDATE SET
      practice_id = EXCLUDED.practice_id,
      updated_at = now();
    
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'rep_id', v_rep_id
  );
END;
$$;
