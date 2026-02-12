
-- Step 1: Create SECURITY DEFINER helper functions to break circular RLS dependency

CREATE OR REPLACE FUNCTION public.is_pharmacy_member(_user_id uuid, _pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pharmacy_staff
    WHERE user_id = _user_id AND pharmacy_id = _pharmacy_id AND active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_pharmacy_owner(_user_id uuid, _pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pharmacies
    WHERE id = _pharmacy_id AND user_id = _user_id
  )
$$;

-- Step 2: Replace recursive policy on pharmacies
DROP POLICY IF EXISTS "pharmacy_manage_own_record" ON public.pharmacies;
CREATE POLICY "pharmacy_manage_own_record" ON public.pharmacies
  FOR ALL
  USING (
    user_id = auth.uid()
    OR public.is_pharmacy_member(auth.uid(), id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_pharmacy_member(auth.uid(), id)
  );

-- Step 3: Replace recursive policy on pharmacy_staff
DROP POLICY IF EXISTS "pharmacy_owner_manage_staff" ON public.pharmacy_staff;
CREATE POLICY "pharmacy_owner_manage_staff" ON public.pharmacy_staff
  FOR ALL
  USING (
    public.is_pharmacy_owner(auth.uid(), pharmacy_id)
  )
  WITH CHECK (
    public.is_pharmacy_owner(auth.uid(), pharmacy_id)
  );

-- Step 4: Clean up admin_alerts duplicate policy (direct user_roles query)
DROP POLICY IF EXISTS "Admins can view all alerts" ON public.admin_alerts;
