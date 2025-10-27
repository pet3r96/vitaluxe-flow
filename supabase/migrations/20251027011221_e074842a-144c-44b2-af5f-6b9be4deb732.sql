-- Fix admin product visibility issue
-- Admins were being restricted by the visibility function
-- This update ensures admins bypass the visibility function entirely

DROP POLICY IF EXISTS "Authenticated users can view visible products" ON public.products;

CREATE POLICY "Authenticated users can view visible products"
ON public.products
FOR SELECT
TO authenticated
USING (
  -- Admins bypass this policy (handled by "Admins can manage all products")
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Non-admins use visibility function
  id IN (
    SELECT * FROM get_visible_products_for_effective_user(auth.uid())
  )
);