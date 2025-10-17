-- Update visibility resolver to handle practice accounts linked to toplines
CREATE OR REPLACE FUNCTION public.get_visible_products_for_user()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_topline uuid;
  is_admin boolean;
  practice_linked_topline uuid;
BEGIN
  -- Admins see all active products
  is_admin := has_role(auth.uid(), 'admin'::app_role);
  IF is_admin THEN
    RETURN QUERY
      SELECT p.id
      FROM public.products p
      WHERE p.active = true;
    RETURN;
  END IF;

  -- Try resolve by practice profile (doctors/providers)
  SELECT linked_topline_id
    INTO practice_linked_topline
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF practice_linked_topline IS NOT NULL THEN
    my_topline := get_topline_rep_id_for_practice(practice_linked_topline);
  END IF;

  -- Fallback for downlines
  IF my_topline IS NULL THEN
    my_topline := get_my_topline_rep_id();
  END IF;

  -- If no topline can be resolved, default to all active
  IF my_topline IS NULL THEN
    RETURN QUERY
      SELECT p.id
      FROM public.products p
      WHERE p.active = true;
    RETURN;
  END IF;

  -- Active products not explicitly hidden by this topline
  RETURN QUERY
    SELECT p.id
    FROM public.products p
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.rep_product_visibility v
        WHERE v.topline_rep_id = my_topline
          AND v.product_id = p.id
          AND v.visible = false
      );
END;
$$;