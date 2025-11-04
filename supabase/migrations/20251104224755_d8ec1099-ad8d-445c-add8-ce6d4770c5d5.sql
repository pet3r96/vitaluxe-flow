-- Add RLS policy for staff to insert order lines for their practice orders

DROP POLICY IF EXISTS "Active staff can insert order lines for their practice" ON public.order_lines;

CREATE POLICY "Active staff can insert order lines for their practice"
ON public.order_lines FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_staff
    WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.active = true
      AND practice_staff.can_order = true
  )
  AND EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.practice_staff ps ON orders.doctor_id = ps.practice_id
    WHERE orders.id = order_lines.order_id
      AND ps.user_id = auth.uid()
  )
);