-- Fix infinite recursion in provider orders RLS policy
-- Drop problematic policy
DROP POLICY IF EXISTS "Providers can view orders containing their prescriptions" ON public.orders;

-- Create security definer function to check provider access
CREATE OR REPLACE FUNCTION public.provider_can_view_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM order_lines ol
    JOIN providers p ON ol.provider_id = p.id
    WHERE ol.order_id = _order_id
    AND p.user_id = _user_id
  );
$$;

-- Recreate policy using security definer function to break recursion
CREATE POLICY "Providers can view orders containing their prescriptions"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'provider'::app_role)
  AND provider_can_view_order(auth.uid(), id)
);