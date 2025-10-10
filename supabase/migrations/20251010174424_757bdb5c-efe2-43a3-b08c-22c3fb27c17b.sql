-- Add RLS policy for pharmacies to view only their assigned orders
CREATE POLICY "Pharmacies can view orders with assigned lines"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'pharmacy'::app_role)
  AND EXISTS (
    SELECT 1
    FROM order_lines ol
    INNER JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
    WHERE ol.order_id = orders.id
      AND ph.user_id = auth.uid()
      AND ol.assigned_pharmacy_id IS NOT NULL
  )
);