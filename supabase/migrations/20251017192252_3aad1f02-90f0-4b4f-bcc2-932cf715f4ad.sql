-- Create pharmacy_rep_assignments table for scoping pharmacies to topline reps
CREATE TABLE IF NOT EXISTS public.pharmacy_rep_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  topline_rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pharmacy_id, topline_rep_id)
);

-- Create product_rep_assignments table for scoping products to topline reps
CREATE TABLE IF NOT EXISTS public.product_rep_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  topline_rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, topline_rep_id)
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pharmacy_rep_assignments_pharmacy ON pharmacy_rep_assignments(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_rep_assignments_topline ON pharmacy_rep_assignments(topline_rep_id);
CREATE INDEX IF NOT EXISTS idx_product_rep_assignments_product ON product_rep_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_rep_assignments_topline ON product_rep_assignments(topline_rep_id);

-- Enable RLS on both tables
ALTER TABLE public.pharmacy_rep_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_rep_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pharmacy_rep_assignments
CREATE POLICY "Admins can manage pharmacy assignments" ON pharmacy_rep_assignments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Toplines can view their pharmacy assignments" ON pharmacy_rep_assignments
  FOR SELECT USING (
    topline_rep_id IN (SELECT id FROM reps WHERE user_id = auth.uid())
  );

-- RLS Policies for product_rep_assignments
CREATE POLICY "Admins can manage product assignments" ON product_rep_assignments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Toplines can view their product assignments" ON product_rep_assignments
  FOR SELECT USING (
    topline_rep_id IN (SELECT id FROM reps WHERE user_id = auth.uid())
  );

-- Update get_visible_products_for_effective_user function to include product scoping logic
CREATE OR REPLACE FUNCTION public.get_visible_products_for_effective_user(p_effective_user_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- NEW SCOPING LOGIC:
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
$$;