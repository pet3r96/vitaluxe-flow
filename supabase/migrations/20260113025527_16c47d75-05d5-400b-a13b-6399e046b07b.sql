-- Add UPDATE policy for doctors/practice owners to update their own orders
-- This enables order cancellation functionality which requires updating order status

CREATE POLICY "practice_update_orders" ON public.orders
FOR UPDATE
USING (
  doctor_id = auth.uid() OR 
  public.can_access_practice_orders(auth.uid(), doctor_id)
);

-- Add comment for documentation
COMMENT ON POLICY "practice_update_orders" ON public.orders IS 'Allows practice owners and authorized staff to update their orders for cancellation and status changes';