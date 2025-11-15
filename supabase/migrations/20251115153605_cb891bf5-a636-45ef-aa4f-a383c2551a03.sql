-- Fix "Loading history..." issue by adding comprehensive RLS policies for order_status_history table

-- Allow practice staff to view status history for orders from their practice
CREATE POLICY "Practice staff can view their practice order status history"
ON order_status_history
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM orders o
    INNER JOIN practice_staff ps ON ps.practice_id = o.doctor_id
    WHERE o.id = order_status_history.order_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);

-- Allow practice owners/doctors to view status history for their practice orders
CREATE POLICY "Practice owners can view their practice order status history"
ON order_status_history
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_status_history.order_id
    AND o.doctor_id = auth.uid()
  )
);

-- Allow providers to view status history for orders they are assigned to
CREATE POLICY "Providers can view order status history for their orders"
ON order_status_history
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM order_lines ol
    INNER JOIN providers p ON p.id = ol.provider_id
    WHERE ol.order_id = order_status_history.order_id
    AND p.user_id = auth.uid()
  )
);