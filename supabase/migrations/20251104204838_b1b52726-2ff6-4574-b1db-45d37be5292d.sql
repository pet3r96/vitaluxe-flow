-- Add SELECT policies for practice_payment_methods visibility
-- Providers and staff can view payment methods for their practice

DROP POLICY IF EXISTS "Active providers can view practice payment methods" ON public.practice_payment_methods;
DROP POLICY IF EXISTS "Active staff can view practice payment methods" ON public.practice_payment_methods;

CREATE POLICY "Active providers can view practice payment methods"
ON public.practice_payment_methods FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers
    WHERE providers.user_id = auth.uid()
      AND providers.practice_id = practice_payment_methods.practice_id
      AND providers.active = true
  )
);

CREATE POLICY "Active staff can view practice payment methods"
ON public.practice_payment_methods FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.practice_staff
    WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.practice_id = practice_payment_methods.practice_id
      AND practice_staff.active = true
      AND practice_staff.can_order = true
  )
);