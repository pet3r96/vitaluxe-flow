-- Add RLS policies for providers and staff to create orders for their practices
-- This fixes the checkout error where providers/staff couldn't create orders

CREATE POLICY "Active providers can create orders for their practice"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'provider'::app_role)
  AND EXISTS (
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
  has_role(auth.uid(), 'staff'::app_role)
  AND EXISTS (
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