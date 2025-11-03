-- Add RLS policy for pharmacies to view orders that have order lines assigned to them
CREATE POLICY "Pharmacies can view orders with assigned lines"
ON public.orders
FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM order_lines ol
    INNER JOIN pharmacies ph ON ol.assigned_pharmacy_id = ph.id
    WHERE ol.order_id = orders.id
      AND ph.user_id = auth.uid()
  )
);