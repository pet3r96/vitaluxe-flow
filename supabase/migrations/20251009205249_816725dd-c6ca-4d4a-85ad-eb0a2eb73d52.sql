-- Drop existing policy
DROP POLICY IF EXISTS "Doctors can manage their own cart" ON public.cart;

-- Create new policies that allow admins to manage any cart
CREATE POLICY "Users can manage their own cart"
ON public.cart
FOR ALL
USING (auth.uid() = doctor_id);

CREATE POLICY "Admins can manage all carts"
ON public.cart
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));