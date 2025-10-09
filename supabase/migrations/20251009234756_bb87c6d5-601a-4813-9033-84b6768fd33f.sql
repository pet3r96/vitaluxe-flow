-- Allow admins to create orders for any active doctor
DROP POLICY IF EXISTS "Admins can create orders for any active doctor" ON public.orders;
CREATE POLICY "Admins can create orders for any active doctor"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = doctor_id AND p.active = true
  )
);

-- Allow doctors to insert their own order lines
DROP POLICY IF EXISTS "Doctors can insert their order lines" ON public.order_lines;
CREATE POLICY "Doctors can insert their order lines"
ON public.order_lines
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.doctor_id = auth.uid()
  )
);

-- Allow admins to insert any order lines
DROP POLICY IF EXISTS "Admins can insert any order lines" ON public.order_lines;
CREATE POLICY "Admins can insert any order lines"
ON public.order_lines
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);
