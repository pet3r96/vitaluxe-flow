-- Fix provider credentials storage in create_user_with_role function
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_user_id uuid, 
  p_email text, 
  p_name text, 
  p_role app_role, 
  p_role_data jsonb DEFAULT '{}'::jsonb, 
  p_status text DEFAULT 'active'::text, 
  p_created_by uuid DEFAULT NULL::uuid, 
  p_temp_password boolean DEFAULT false
)
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
    v_parent_id := NULL;
    
    INSERT INTO public.reps (user_id, role, assigned_topline_id)
    VALUES (p_user_id, p_role, NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      role = EXCLUDED.role,
      assigned_topline_id = NULL,
      updated_at = now()
    RETURNING id INTO v_rep_id;

  ELSIF p_role = 'downline' THEN
    -- Support both linkedToplineId and parentId for backward compatibility
    IF p_role_data ? 'linkedToplineId' THEN
      v_parent_id := (p_role_data->>'linkedToplineId')::uuid;
    ELSIF p_role_data ? 'parentId' THEN
      v_parent_id := (p_role_data->>'parentId')::uuid;
    END IF;
    
    -- Downlines MUST have a parent topline
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
    -- Insert basic provider link (only user_id and practice_id exist in providers table)
    INSERT INTO public.providers (user_id, practice_id)
    VALUES (p_user_id, (p_role_data->>'practiceId')::uuid)
    ON CONFLICT (user_id) DO UPDATE SET
      practice_id = EXCLUDED.practice_id,
      updated_at = now();
    
    -- Store prescriber credentials in profiles table where these columns exist
    UPDATE public.profiles
    SET
      npi = COALESCE((p_role_data->>'npi'), npi),
      dea = COALESCE((p_role_data->>'dea'), dea),
      license_number = COALESCE((p_role_data->>'licenseNumber'), license_number),
      phone = COALESCE((p_role_data->>'phone'), phone),
      updated_at = now()
    WHERE id = p_user_id;
      
  ELSIF p_role = 'doctor' THEN
    -- Doctor/practice accounts store everything in profiles table
    -- linked_topline_id can be NULL (admin-owned practice) or a UUID (rep-owned)
    
    IF p_role_data IS NOT NULL AND p_role_data != '{}'::jsonb THEN
      UPDATE public.profiles
      SET
        license_number = COALESCE((p_role_data->>'licenseNumber'), license_number),
        npi = COALESCE((p_role_data->>'npi'), npi),
        practice_npi = COALESCE((p_role_data->>'practiceNpi'), practice_npi),
        dea = COALESCE((p_role_data->>'dea'), dea),
        phone = COALESCE((p_role_data->>'phone'), phone),
        company = COALESCE((p_role_data->>'company'), company),
        linked_topline_id = CASE 
          WHEN p_role_data ? 'linkedToplineId' 
          THEN (p_role_data->>'linkedToplineId')::uuid
          ELSE linked_topline_id
        END,
        updated_at = now()
      WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'rep_id', v_rep_id
  );
END;
$function$;