-- Fix provider and staff order creation policies
-- Remove has_role() dependency and rely on membership tables only

DROP POLICY IF EXISTS "Active providers can create orders for their practice" ON public.orders;
DROP POLICY IF EXISTS "Active staff can create orders for their practice" ON public.orders;

CREATE POLICY "Active providers can create orders for their practice"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers
    WHERE providers.user_id = auth.uid()
      AND providers.practice_id = orders.doctor_id
      AND providers.active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = orders.doctor_id
      AND profiles.active = true
  )
);

CREATE POLICY "Active staff can create orders for their practice"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_staff
    WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.practice_id = orders.doctor_id
      AND practice_staff.active = true
      AND practice_staff.can_order = true
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = orders.doctor_id
      AND profiles.active = true
  )
);