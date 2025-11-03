-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Pharmacies can view orders with assigned lines" ON public.orders;

-- Create a security definer function to check if pharmacy can view order
-- This prevents infinite recursion by bypassing RLS checks
CREATE OR REPLACE FUNCTION public.pharmacy_can_view_order(order_uuid UUID, pharmacy_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM order_lines ol
    INNER JOIN pharmacies ph ON ol.assigned_pharmacy_id = ph.id
    WHERE ol.order_id = order_uuid
      AND ph.user_id = pharmacy_user_id
  );
END;
$$;

-- Create new non-recursive policy using the function
CREATE POLICY "Pharmacies can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) 
  AND pharmacy_can_view_order(id, auth.uid())
);