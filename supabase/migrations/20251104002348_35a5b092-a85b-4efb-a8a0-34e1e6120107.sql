-- ================================================
-- RLS Policies for Providers to View Their Orders
-- ================================================

-- 1. Allow providers to view order lines they prescribed
CREATE POLICY "Providers can view their prescribed order lines"
ON public.order_lines
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'provider'::app_role) 
  AND provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- 2. Allow providers to view orders containing their order lines
CREATE POLICY "Providers can view orders containing their prescriptions"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'provider'::app_role)
  AND EXISTS (
    SELECT 1 
    FROM order_lines ol
    JOIN providers p ON ol.provider_id = p.id
    WHERE ol.order_id = orders.id
    AND p.user_id = auth.uid()
  )
);

-- 3. Allow providers to insert order lines for their practice orders
CREATE POLICY "Providers can insert order lines for their practice orders"
ON public.order_lines
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'provider'::app_role)
  AND provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 
    FROM orders o
    JOIN providers p ON o.doctor_id = p.practice_id
    WHERE o.id = order_lines.order_id
    AND p.user_id = auth.uid()
  )
);