-- Fix get_visible_products_for_effective_user to properly handle topline users
-- This ensures topline users are subject to product_rep_assignments scoping

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

  -- NEW: Handle topline users - they should see products assigned to them
  IF my_topline IS NULL THEN
    SELECT r.id
      INTO my_topline
    FROM public.reps r
    WHERE r.user_id = effective_user
      AND r.role = 'topline'::app_role
    LIMIT 1;
  END IF;

  -- Secure default for doctor/provider if no topline could be resolved
  IF my_topline IS NULL THEN
    IF has_role(effective_user, 'doctor'::app_role) OR has_role(effective_user, 'provider'::app_role) THEN
      RETURN QUERY SELECT p.id FROM public.products p WHERE 1=0; -- empty set
      RETURN;
    ELSE
      -- For other roles keep prior fallback (e.g., reps without linkage yet)
      RETURN QUERY
        SELECT p.id
        FROM public.products p
        WHERE p.active = true;
      RETURN;
    END IF;
  END IF;

  -- SCOPING LOGIC:
  -- 1. Check if product has specific assignments in product_rep_assignments
  -- 2. If product has assignments: only show if my_topline is in the list
  -- 3. If product has no assignments (global): show unless explicitly hidden by rep_product_visibility
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