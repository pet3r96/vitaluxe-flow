-- Drop the existing restrictive policy that only allows 'admin' role
DROP POLICY IF EXISTS "Admins can view all pharmacy transmissions" ON public.pharmacy_order_transmissions;

-- Create new SELECT policy that includes both admin and super_admin roles
CREATE POLICY "Admins can view all pharmacy transmissions"
ON public.pharmacy_order_transmissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role])
  )
);

-- Add DELETE policy for admins (enables "Clear All" functionality)
CREATE POLICY "Admins can delete pharmacy transmissions"
ON public.pharmacy_order_transmissions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role])
  )
);