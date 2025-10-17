-- Robust get_topline_rep_id_for_practice: handles both user_id and reps.id lookups
CREATE OR REPLACE FUNCTION public.get_topline_rep_id_for_practice(_practice_linked_topline_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rep_id uuid;
  v_rep_role app_role;
  v_assigned_topline_id uuid;
BEGIN
  -- First try by user_id
  SELECT id, role, assigned_topline_id
  INTO v_rep_id, v_rep_role, v_assigned_topline_id
  FROM public.reps
  WHERE user_id = _practice_linked_topline_user_id
  LIMIT 1;

  IF v_rep_id IS NULL THEN
    -- Fallback: try by reps.id (supports data where linked_topline_id stores reps.id)
    SELECT id, role, assigned_topline_id
    INTO v_rep_id, v_rep_role, v_assigned_topline_id
    FROM public.reps
    WHERE id = _practice_linked_topline_user_id
    LIMIT 1;
  END IF;

  IF v_rep_role = 'topline'::app_role THEN
    RETURN v_rep_id;
  ELSIF v_rep_role = 'downline'::app_role THEN
    RETURN v_assigned_topline_id;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Update get_visible_products_for_user with secure default for practices/providers
CREATE OR REPLACE FUNCTION public.get_visible_products_for_user()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
declare
  my_topline uuid;
  is_admin boolean;
  practice_linked_topline uuid;
  provider_practice_id uuid;
begin
  -- Admins see all active products
  is_admin := has_role(auth.uid(), 'admin'::app_role);
  if is_admin then
    return query
      select p.id
      from public.products p
      where p.active = true;
    return;
  end if;

  -- Check if user is a provider (provider role)
  select practice_id
    into provider_practice_id
  from public.providers
  where user_id = auth.uid()
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
    -- Not a provider: check if it's a practice/doctor account
    select linked_topline_id
      into practice_linked_topline
    from public.profiles
    where id = auth.uid()
    limit 1;

    if practice_linked_topline is not null then
      my_topline := get_topline_rep_id_for_practice(practice_linked_topline);
    end if;
  end if;

  -- Fallback for downlines
  if my_topline is null then
    my_topline := get_my_topline_rep_id();
  end if;

  -- Secure default: if no topline for doctor/provider, show no products
  if my_topline is null then
    if has_role(auth.uid(), 'doctor'::app_role) or has_role(auth.uid(), 'provider'::app_role) then
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
$$;