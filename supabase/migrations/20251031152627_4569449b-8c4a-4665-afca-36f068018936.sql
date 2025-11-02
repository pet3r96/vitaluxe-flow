-- Fix 1: Update get_visible_products_for_effective_user to show all products for independent practices
CREATE OR REPLACE FUNCTION public.get_visible_products_for_effective_user(p_effective_user_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  effective_user uuid := p_effective_user_id;
  my_topline uuid;
  is_admin_effective boolean;
  practice_linked_topline uuid;
  provider_practice_id uuid;
BEGIN
  -- Default to current user when parameter is null
  IF effective_user IS NULL THEN
    effective_user := auth.uid();
  END IF;

  -- Only admins can request visibility for a different effective user
  IF effective_user IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can specify a different effective user';
  END IF;

  -- Admins (as effective user) see all active products
  is_admin_effective := has_role(effective_user, 'admin'::app_role);
  IF is_admin_effective THEN
    RETURN QUERY
      SELECT p.id
      FROM public.products p
      WHERE p.active = true;
    RETURN;
  END IF;

  -- If effective user is a provider, resolve practice -> linked_topline
  SELECT pr.practice_id
    INTO provider_practice_id
  FROM public.providers pr
  WHERE pr.user_id = effective_user
  LIMIT 1;

  IF provider_practice_id IS NOT NULL THEN
    SELECT pf.linked_topline_id
      INTO practice_linked_topline
    FROM public.profiles pf
    WHERE pf.id = provider_practice_id
    LIMIT 1;

    IF practice_linked_topline IS NOT NULL THEN
      my_topline := get_topline_rep_id_for_practice(practice_linked_topline);
    END IF;
  ELSE
    -- Practice/doctor account
    SELECT pf.linked_topline_id
      INTO practice_linked_topline
    FROM public.profiles pf
    WHERE pf.id = effective_user
    LIMIT 1;

    IF practice_linked_topline IS NOT NULL THEN
      my_topline := get_topline_rep_id_for_practice(practice_linked_topline);
    END IF;
  END IF;

  -- Fallback for downline reps: resolve their assigned topline directly by effective user
  IF my_topline IS NULL THEN
    SELECT r.assigned_topline_id
      INTO my_topline
    FROM public.reps r
    WHERE r.user_id = effective_user
      AND r.role = 'downline'::app_role
    LIMIT 1;
  END IF;

  -- Handle topline users - they should see products assigned to them
  IF my_topline IS NULL THEN
    SELECT r.id
      INTO my_topline
    FROM public.reps r
    WHERE r.user_id = effective_user
      AND r.role = 'topline'::app_role
    LIMIT 1;
  END IF;

  -- CRITICAL FIX: Independent practices (no topline) see ALL active products at retail_price
  IF my_topline IS NULL THEN
    IF has_role(effective_user, 'doctor'::app_role) OR has_role(effective_user, 'provider'::app_role) THEN
      -- Independent practice: return ALL active products (will use retail_price)
      RETURN QUERY
        SELECT p.id
        FROM public.products p
        WHERE p.active = true;
      RETURN;
    ELSE
      -- For other roles keep prior fallback
      RETURN QUERY
        SELECT p.id
        FROM public.products p
        WHERE p.active = true;
      RETURN;
    END IF;
  END IF;

  -- SCOPING LOGIC for practices with reps:
  RETURN QUERY
    SELECT p.id
    FROM public.products p
    WHERE p.active = true
      AND (
        -- Product is scoped AND user's topline is in the assignment list
        (EXISTS (
          SELECT 1 FROM product_rep_assignments pra 
          WHERE pra.product_id = p.id AND pra.topline_rep_id = my_topline
        ))
        OR
        -- Product is global (no assignments) AND not explicitly hidden
        (NOT EXISTS (
          SELECT 1 FROM product_rep_assignments pra WHERE pra.product_id = p.id
        ) AND NOT EXISTS (
          SELECT 1 FROM rep_product_visibility v
          WHERE v.topline_rep_id = my_topline
            AND v.product_id = p.id
            AND v.visible = false
        ))
      );
END;
$function$;

-- Fix 2: Update create_user_with_role to properly save provider credentials
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
    
    -- CRITICAL FIX: Store prescriber credentials directly (no COALESCE for new providers)
    UPDATE public.profiles
    SET
      npi = (p_role_data->>'npi'),
      dea = (p_role_data->>'dea'),
      license_number = (p_role_data->>'licenseNumber'),
      phone = (p_role_data->>'phone'),
      full_name = COALESCE((p_role_data->>'fullName'), full_name),
      updated_at = now()
    WHERE id = p_user_id;
      
  ELSIF p_role = 'doctor' THEN
    IF p_role_data IS NOT NULL AND p_role_data != '{}'::jsonb THEN
      UPDATE public.profiles
      SET
        license_number = COALESCE((p_role_data->>'licenseNumber'), license_number),
        npi = COALESCE((p_role_data->>'npi'), npi),
        practice_npi = COALESCE((p_role_data->>'practiceNpi'), practice_npi),
        linked_topline_id = COALESCE((p_role_data->>'linkedToplineId')::uuid, linked_topline_id),
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