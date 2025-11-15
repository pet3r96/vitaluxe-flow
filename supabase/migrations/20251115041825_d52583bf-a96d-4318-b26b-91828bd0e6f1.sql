-- Fix get_visible_products_for_effective_user function for topline reps and SQL ambiguity
CREATE OR REPLACE FUNCTION public.get_visible_products_for_effective_user(p_effective_user_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  my_topline uuid;
  staff_practice_id uuid;
  provider_practice_id uuid;
BEGIN
  -- Step 1: Check if the user IS themselves a topline rep
  select r.id into my_topline
  from reps r
  where r.user_id = p_effective_user_id
    and r.role = 'topline'::app_role
  limit 1;

  -- If user is a topline rep, use their own rep ID
  if my_topline is not null then
    -- Topline sees all active products except those explicitly hidden
    return query
    select distinct p.id
    from products p
    where p.active = true
      and not exists (
        select 1
        from rep_product_visibility rpv
        where rpv.topline_rep_id = my_topline
          and rpv.product_id = p.id
          and rpv.visible = false
      );
    return;
  end if;

  -- Step 2: Check if user is staff of a practice (fix ambiguous id)
  select profiles.practice_id into staff_practice_id
  from profiles
  where profiles.id = p_effective_user_id
    and profiles.role = 'staff'::app_role
  limit 1;

  if staff_practice_id is not null then
    -- Staff inherits topline rep from their practice
    select r.id into my_topline
    from reps r
    inner join profiles pr on pr.topline_rep_id = r.id
    where pr.id = staff_practice_id
      and r.role = 'topline'::app_role
    limit 1;
  end if;

  -- Step 3: Check if user is a provider (fix ambiguous id)
  if my_topline is null then
    select r.id into my_topline
    from reps r
    inner join providers pv on pv.topline_rep_id = r.id
    where pv.user_id = p_effective_user_id
      and r.role = 'topline'::app_role
    limit 1;
  end if;

  -- Step 4: Check if user is a practice (fix ambiguous id)
  if my_topline is null then
    select r.id into my_topline
    from reps r
    inner join profiles pr on pr.topline_rep_id = r.id
    where pr.id = p_effective_user_id
      and pr.role = 'practice'::app_role
      and r.role = 'topline'::app_role
    limit 1;
  end if;

  -- Return visible products based on the topline rep
  if my_topline is not null then
    return query
    select distinct p.id
    from products p
    where p.active = true
      and not exists (
        select 1
        from rep_product_visibility rpv
        where rpv.topline_rep_id = my_topline
          and rpv.product_id = p.id
          and rpv.visible = false
      );
  else
    -- No topline rep found - return all active products
    return query
    select p.id
    from products p
    where p.active = true;
  end if;

  return;
END;
$$;