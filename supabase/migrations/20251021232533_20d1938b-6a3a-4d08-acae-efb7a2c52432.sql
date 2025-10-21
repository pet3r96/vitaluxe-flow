-- Update create_user_with_role to support new auth flow parameters
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role app_role,
  p_role_data jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'active',
  p_created_by uuid DEFAULT NULL,
  p_temp_password boolean DEFAULT FALSE
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

-- Update impersonation permissions to only allow info@vitaluxeservices.com
-- First, revoke all existing impersonation permissions
UPDATE public.impersonation_permissions
SET can_impersonate = false,
    revoked_at = now(),
    notes = 'Revoked during Phase 2 migration - restricted to primary admin only'
WHERE can_impersonate = true;

-- Grant impersonation only to info@vitaluxeservices.com
INSERT INTO public.impersonation_permissions (user_id, can_impersonate, granted_by, notes)
SELECT 
  au.id,
  true,
  au.id,
  'Primary admin - granted during Phase 2 migration'
FROM auth.users au
WHERE LOWER(au.email) = 'info@vitaluxeservices.com'
ON CONFLICT (user_id) DO UPDATE SET
  can_impersonate = true,
  revoked_at = NULL,
  updated_at = now(),
  notes = 'Primary admin - updated during Phase 2 migration';

-- Add comment documenting the restriction
COMMENT ON TABLE public.impersonation_permissions IS 
'Impersonation is restricted to info@vitaluxeservices.com only for security purposes';