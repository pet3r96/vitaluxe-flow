-- Create function to get visible pharmacies for effective user (similar to products pattern)
CREATE OR REPLACE FUNCTION public.get_visible_pharmacies_for_effective_user(p_effective_user_id uuid)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  effective_user uuid := p_effective_user_id;
  my_topline_rep_id uuid;
  is_admin_effective boolean;
BEGIN
  -- Default to current user when parameter is null
  IF effective_user IS NULL THEN
    effective_user := auth.uid();
  END IF;

  -- Only admins can request visibility for a different effective user
  IF effective_user IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can specify a different effective user';
  END IF;

  -- Admins (as effective user) see all active pharmacies
  is_admin_effective := has_role(effective_user, 'admin'::app_role);
  IF is_admin_effective THEN
    RETURN QUERY
      SELECT p.id
      FROM public.pharmacies p
      WHERE p.active = true;
    RETURN;
  END IF;

  -- Get the topline rep ID for the effective user
  SELECT r.id INTO my_topline_rep_id
  FROM public.reps r
  WHERE r.user_id = effective_user
    AND r.role = 'topline'::app_role
  LIMIT 1;

  -- If not a topline rep, return empty set (only admins and topline reps can see pharmacies)
  IF my_topline_rep_id IS NULL THEN
    RETURN QUERY SELECT p.id FROM public.pharmacies p WHERE 1=0;
    RETURN;
  END IF;

  -- SCOPING LOGIC for topline reps:
  -- 1. If pharmacy has specific assignments in pharmacy_rep_assignments: only show if user's topline is assigned
  -- 2. If pharmacy has no assignments (global): show it (not explicitly hidden)
  RETURN QUERY
    SELECT p.id
    FROM public.pharmacies p
    WHERE p.active = true
      AND (
        -- Pharmacy is assigned to this topline rep
        EXISTS (
          SELECT 1 FROM public.pharmacy_rep_assignments pra 
          WHERE pra.pharmacy_id = p.id AND pra.topline_rep_id = my_topline_rep_id
        )
        OR
        -- Pharmacy is global (no specific assignments)
        NOT EXISTS (
          SELECT 1 FROM public.pharmacy_rep_assignments pra WHERE pra.pharmacy_id = p.id
        )
      );
END;
$function$;

-- Drop overly permissive RLS policies
DROP POLICY IF EXISTS "All authenticated users can view pharmacies" ON public.pharmacies;
DROP POLICY IF EXISTS "Authenticated users can view active pharmacies" ON public.pharmacies;

-- Create new scoped RLS policy for pharmacy visibility
CREATE POLICY "Authenticated users can view visible pharmacies" ON public.pharmacies
  FOR SELECT USING (
    id IN (SELECT get_visible_pharmacies_for_effective_user(auth.uid()))
  );