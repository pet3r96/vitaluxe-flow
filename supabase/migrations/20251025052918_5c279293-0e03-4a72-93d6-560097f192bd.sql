-- Fix product visibility RLS policies to respect product_rep_assignments
-- Drop the overly permissive policy that allows all authenticated users to see all products
DROP POLICY IF EXISTS "All authenticated users can view products" ON public.products;

-- Drop and recreate the restrictive policy to use the correct visibility function
-- that respects product_rep_assignments
DROP POLICY IF EXISTS "Authenticated users can view visible products" ON public.products;

CREATE POLICY "Authenticated users can view visible products"
ON public.products
FOR SELECT
TO authenticated
USING (id IN (
  SELECT * FROM get_visible_products_for_effective_user(auth.uid())
));