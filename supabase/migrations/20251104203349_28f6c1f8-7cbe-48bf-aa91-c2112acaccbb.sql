-- Add SELECT policies for orders visibility without has_role()
-- Providers and staff can view orders for their practice based on membership tables

DROP POLICY IF EXISTS "Active providers can view practice orders" ON public.orders;
DROP POLICY IF EXISTS "Active staff can view practice orders" ON public.orders;

CREATE POLICY "Active providers can view practice orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers
    WHERE providers.user_id = auth.uid()
      AND providers.practice_id = orders.doctor_id
      AND providers.active = true
  )
);

CREATE POLICY "Active staff can view practice orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.practice_staff
    WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.practice_id = orders.doctor_id
      AND practice_staff.active = true
  )
);
