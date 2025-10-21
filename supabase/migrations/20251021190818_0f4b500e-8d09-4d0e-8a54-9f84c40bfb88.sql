-- Drop old hardcoded email-based policies
DROP POLICY IF EXISTS "Admin can insert impersonation logs" ON public.impersonation_logs;
DROP POLICY IF EXISTS "Admin can update impersonation logs" ON public.impersonation_logs;

-- Create new role-based INSERT policy with IP ban check
CREATE POLICY "Admins can insert impersonation logs unless IP banned"
ON public.impersonation_logs
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_admin_ip_banned()
);

-- Create new role-based UPDATE policy with IP ban check
CREATE POLICY "Admins can update impersonation logs unless IP banned"
ON public.impersonation_logs
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_admin_ip_banned()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_admin_ip_banned()
);