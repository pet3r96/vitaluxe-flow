-- Add UPDATE policy for order_profits table to allow admins to update payment status
CREATE POLICY "Admins can update order profits"
ON order_profits
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));