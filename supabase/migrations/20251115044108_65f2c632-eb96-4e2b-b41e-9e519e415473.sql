-- Fix get_visible_products_for_effective_user - correct column references (no DROP needed)
CREATE OR REPLACE FUNCTION public.get_visible_products_for_effective_user(p_effective_user_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  my_topline_rep_id uuid;
  user_practice_id uuid;
  user_role_name app_role;
BEGIN
  -- Step 1: Check if user IS a topline rep themselves
  SELECT r.id INTO my_topline_rep_id
  FROM reps r
  WHERE r.user_id = p_effective_user_id
    AND r.role = 'topline'::app_role
  LIMIT 1;

  IF my_topline_rep_id IS NOT NULL THEN
    -- User is topline: return all active products except explicitly hidden
    RETURN QUERY
    SELECT DISTINCT p.id
    FROM products p
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1 FROM rep_product_visibility rpv
        WHERE rpv.topline_rep_id = my_topline_rep_id
          AND rpv.product_id = p.id
          AND rpv.visible = false
      );
    RETURN;
  END IF;

  -- Step 2: Get user's role from user_roles table
  SELECT role INTO user_role_name
  FROM user_roles
  WHERE user_id = p_effective_user_id
  LIMIT 1;

  -- Step 3: Handle staff users - get practice from providers table
  IF user_role_name = 'staff'::app_role THEN
    SELECT pv.practice_id INTO user_practice_id
    FROM providers pv
    WHERE pv.user_id = p_effective_user_id
      AND pv.role_type = 'staff'
      AND pv.active = true
    LIMIT 1;

    IF user_practice_id IS NOT NULL THEN
      -- Get practice's linked topline, then lookup rep record
      SELECT r.id INTO my_topline_rep_id
      FROM profiles pr
      INNER JOIN reps r ON r.user_id = pr.linked_topline_id
      WHERE pr.id = user_practice_id
        AND r.role = 'topline'::app_role
      LIMIT 1;
    END IF;
  END IF;

  -- Step 4: Handle provider users - get practice from providers table
  IF my_topline_rep_id IS NULL AND user_role_name = 'provider'::app_role THEN
    SELECT pv.practice_id INTO user_practice_id
    FROM providers pv
    WHERE pv.user_id = p_effective_user_id
      AND pv.role_type = 'provider'
      AND pv.active = true
    LIMIT 1;

    IF user_practice_id IS NOT NULL THEN
      -- Get practice's linked topline, then lookup rep record
      SELECT r.id INTO my_topline_rep_id
      FROM profiles pr
      INNER JOIN reps r ON r.user_id = pr.linked_topline_id
      WHERE pr.id = user_practice_id
        AND r.role = 'topline'::app_role
      LIMIT 1;
    END IF;
  END IF;

  -- Step 5: Handle practice (doctor) users - user IS the practice
  IF my_topline_rep_id IS NULL AND user_role_name = 'doctor'::app_role THEN
    -- Get practice's linked topline, then lookup rep record
    SELECT r.id INTO my_topline_rep_id
    FROM profiles pr
    INNER JOIN reps r ON r.user_id = pr.linked_topline_id
    WHERE pr.id = p_effective_user_id
      AND r.role = 'topline'::app_role
    LIMIT 1;
  END IF;

  -- Step 6: Handle admin users - see all products
  IF user_role_name = 'admin'::app_role THEN
    RETURN QUERY
    SELECT p.id
    FROM products p
    WHERE p.active = true;
    RETURN;
  END IF;

  -- Return visible products based on topline rep (if found)
  IF my_topline_rep_id IS NOT NULL THEN
    RETURN QUERY
    SELECT DISTINCT p.id
    FROM products p
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1 FROM rep_product_visibility rpv
        WHERE rpv.topline_rep_id = my_topline_rep_id
          AND rpv.product_id = p.id
          AND rpv.visible = false
      );
  ELSE
    -- No topline rep found: return all active products (safe default)
    RETURN QUERY
    SELECT p.id
    FROM products p
    WHERE p.active = true;
  END IF;

  RETURN;
END;
$$;