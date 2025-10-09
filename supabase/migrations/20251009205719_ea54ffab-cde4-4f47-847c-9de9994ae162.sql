-- Add policy to allow admins to manage all cart lines
CREATE POLICY "Admins can manage all cart lines"
ON public.cart_lines
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));