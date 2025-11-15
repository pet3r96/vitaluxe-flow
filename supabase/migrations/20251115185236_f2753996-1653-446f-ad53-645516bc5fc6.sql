-- ============================================================================
-- Clean up duplicate and overlapping RLS policies on products table
-- ============================================================================

-- Drop the legacy duplicate policy (public role - redundant with authenticated admin policy)
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

-- Drop existing SELECT policies to consolidate them
DROP POLICY IF EXISTS "Authenticated users can view visible products" ON public.products;
DROP POLICY IF EXISTS "Staff can view practice visible products" ON public.products;
DROP POLICY IF EXISTS "Users can view available products" ON public.products;

-- Create consolidated SELECT policies (reduces policy evaluation overhead)

-- 1. Admin SELECT policy (covers all products for admins)
CREATE POLICY "products_select_admin"
ON public.products
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Standard user SELECT policy (applies visibility function for non-admins)
CREATE POLICY "products_select_visible"
ON public.products
FOR SELECT
TO authenticated
USING (
  -- Non-admins see only visible products (function returns id column)
  NOT has_role(auth.uid(), 'admin'::app_role)
  AND id IN (
    SELECT id 
    FROM get_visible_products_for_effective_user(auth.uid())
  )
);

-- Keep existing UPDATE/DELETE policies unchanged (they're already consolidated)
-- "Only admins can update products" (UPDATE)
-- "Only admins can delete products" (DELETE)
-- "Admin can insert products" (INSERT)

-- Add helpful comment
COMMENT ON POLICY "products_select_admin" ON public.products IS 
'Admins can view all products without visibility restrictions';

COMMENT ON POLICY "products_select_visible" ON public.products IS 
'Non-admin users see only products visible via get_visible_products_for_effective_user function';

-- ============================================================================
-- Add performance indexes for product visibility queries
-- ============================================================================

-- Index for rep_product_visibility lookups (used by visibility function)
CREATE INDEX IF NOT EXISTS idx_rep_product_visibility_lookup 
ON public.rep_product_visibility(topline_rep_id, product_id, visible)
WHERE visible = true;

-- Index for active products filter
CREATE INDEX IF NOT EXISTS idx_products_active 
ON public.products(active)
WHERE active = true;

-- Composite index for common product queries (active + created_at for sorting)
CREATE INDEX IF NOT EXISTS idx_products_active_created 
ON public.products(active, created_at DESC)
WHERE active = true;