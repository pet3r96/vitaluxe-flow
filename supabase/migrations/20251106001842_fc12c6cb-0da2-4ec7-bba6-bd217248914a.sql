-- Update get_visible_products_for_effective_user to filter Rx products for non-prescriber practices
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
  practice_has_prescriber boolean := true; -- Default to true for backward compatibility
BEGIN
  -- Detect admin context
  is_admin_effective := EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = effective_user AND role = 'admin'
  );

  IF is_admin_effective THEN
    -- Admin sees all products
    RETURN QUERY SELECT p.id FROM products p WHERE p.active = true;
    RETURN;
  END IF;

  -- Check if effective user is a provider, and if so, find their practice_id
  SELECT practice_id INTO provider_practice_id
  FROM providers
  WHERE providers.id = effective_user;

  -- Determine the topline the effective user is linked to
  -- If effective_user is a practice, use their linked_topline_id directly
  IF provider_practice_id IS NULL THEN
    SELECT pf.linked_topline_id INTO my_topline
    FROM profiles pf
    WHERE pf.id = effective_user;
  ELSE
    -- If effective_user is a provider, get topline from their practice
    SELECT pf.linked_topline_id INTO my_topline
    FROM profiles pf
    WHERE pf.id = provider_practice_id;
  END IF;

  -- If effective user is a topline or downline themselves
  IF my_topline IS NULL THEN
    SELECT pf.id INTO my_topline
    FROM profiles pf
    JOIN user_roles ur ON ur.user_id = pf.id
    WHERE pf.id = effective_user
      AND ur.role IN ('topline', 'downline');
  END IF;

  -- NEW: Check if practice has prescriber capability
  -- For providers, check their practice's has_prescriber status
  -- For practices, check their own has_prescriber status
  SELECT COALESCE(pf.has_prescriber, true) INTO practice_has_prescriber
  FROM profiles pf
  WHERE pf.id = COALESCE(provider_practice_id, effective_user)
  LIMIT 1;

  -- If practice has no prescriber, filter out Rx products
  -- Otherwise, use existing product visibility logic
  RETURN QUERY
    SELECT p.id
    FROM products p
    WHERE p.active = true
      -- Existing visibility logic: check rep assignments and visibility settings
      AND (
        (EXISTS (
          SELECT 1 FROM product_rep_assignments pra 
          WHERE pra.product_id = p.id AND pra.topline_rep_id = my_topline
        ))
        OR
        (NOT EXISTS (
          SELECT 1 FROM product_rep_assignments pra WHERE pra.product_id = p.id
        ) AND NOT EXISTS (
          SELECT 1 FROM rep_product_visibility v
          WHERE v.topline_rep_id = my_topline
            AND v.product_id = p.id
            AND v.visible = false
        ))
      )
      -- NEW: Filter Rx products for non-prescriber practices
      AND (
        practice_has_prescriber = true OR 
        p.requires_prescription = false
      );
END;
$function$;