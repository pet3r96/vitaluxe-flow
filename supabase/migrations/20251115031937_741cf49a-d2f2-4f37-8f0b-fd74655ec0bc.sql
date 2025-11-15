-- ============================================================================
-- EMERGENCY FIX: Staff Product Visibility
-- Staff should see products visible to their practice (via practice's topline rep)
-- NOT all products like admins
-- ============================================================================

-- Fix get_visible_products_for_effective_user to handle staff correctly
CREATE OR REPLACE FUNCTION public.get_visible_products_for_effective_user(p_effective_user_id uuid)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  my_topline uuid;
  is_admin boolean;
  practice_linked_topline uuid;
  provider_practice_id uuid;
  staff_practice_id uuid;
begin
  -- Only ADMINS bypass filtering (not staff)
  is_admin := EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_effective_user_id 
    AND role = 'admin'
  );
  
  if is_admin then
    return query
      select p.id
      from public.products p
      where p.active = true;
    return;
  end if;

  -- Check if user is staff - get their practice_id
  select practice_id
    into staff_practice_id
  from public.providers
  where user_id = p_effective_user_id
    and role_type = 'staff'
  limit 1;

  if staff_practice_id is not null then
    -- Staff: use their practice's linked_topline_id
    select linked_topline_id
      into practice_linked_topline
    from public.profiles
    where id = staff_practice_id
    limit 1;
    
    if practice_linked_topline is not null then
      my_topline := get_topline_rep_id_for_practice(practice_linked_topline);
    end if;
  else
    -- Check if user is a provider (provider role)
    select practice_id
      into provider_practice_id
    from public.providers
    where user_id = p_effective_user_id
      and role_type = 'provider'
    limit 1;

    if provider_practice_id is not null then
      -- Provider: get the practice's linked_topline_id
      select linked_topline_id
        into practice_linked_topline
      from public.profiles
      where id = provider_practice_id
      limit 1;
      
      if practice_linked_topline is not null then
        my_topline := get_topline_rep_id_for_practice(practice_linked_topline);
      end if;
    else
      -- Not a provider or staff: check if it's a practice/doctor account
      select linked_topline_id
        into practice_linked_topline
      from public.profiles
      where id = p_effective_user_id
      limit 1;

      if practice_linked_topline is not null then
        my_topline := get_topline_rep_id_for_practice(practice_linked_topline);
      end if;
    end if;
  end if;

  -- Fallback for downlines
  if my_topline is null then
    my_topline := get_my_topline_rep_id();
  end if;

  -- Secure default: if no topline for doctor/provider/staff, show no products
  if my_topline is null then
    if has_role(p_effective_user_id, 'doctor'::app_role) 
       or has_role(p_effective_user_id, 'provider'::app_role)
       or has_role(p_effective_user_id, 'staff'::app_role) then
      return query select p.id from public.products p where 1=0;
      return;
    else
      -- For other roles keep prior fallback
      return query
        select p.id
        from public.products p
        where p.active = true;
      return;
    end if;
  end if;

  -- Active products not explicitly hidden by this topline
  return query
    select p.id
    from public.products p
    where p.active = true
      and not exists (
        select 1
        from public.rep_product_visibility v
        where v.topline_rep_id = my_topline
          and v.product_id = p.id
          and v.visible = false
      );
end;
$function$;

-- Add RLS policy for staff to view practice products (backup safety)
DROP POLICY IF EXISTS "Staff can view practice products" ON public.products;
CREATE POLICY "Staff can view practice products"
ON public.products
FOR SELECT
TO authenticated
USING (
  -- Staff can see products visible to their practice
  EXISTS (
    SELECT 1 FROM providers pr
    WHERE pr.user_id = auth.uid()
      AND pr.role_type = 'staff'
      AND products.id IN (
        SELECT * FROM get_visible_products_for_effective_user(pr.practice_id)
      )
  )
);