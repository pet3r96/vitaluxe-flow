-- Allow staff to view orders for their practice
CREATE POLICY "Staff can view their practice orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
  AND doctor_id IN (
    SELECT practice_id 
    FROM public.practice_staff 
    WHERE user_id = auth.uid() 
      AND active = true
  )
);

-- Allow staff to view order lines for their practice orders
CREATE POLICY "Staff can view their practice order lines"
ON public.order_lines FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
  AND order_id IN (
    SELECT id FROM public.orders
    WHERE doctor_id IN (
      SELECT practice_id 
      FROM public.practice_staff 
      WHERE user_id = auth.uid() 
        AND active = true
    )
  )
);