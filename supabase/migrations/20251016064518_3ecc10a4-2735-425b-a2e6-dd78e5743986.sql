-- Drop existing policies first (both old and new)
DROP POLICY IF EXISTS "Admins manage encryption keys unless banned" ON public.encryption_keys;
DROP POLICY IF EXISTS "Admins view encryption keys unless banned" ON public.encryption_keys;
DROP POLICY IF EXISTS "Admins can manage encryption keys" ON public.encryption_keys;
DROP POLICY IF EXISTS "Admins can view encryption keys" ON public.encryption_keys;
DROP POLICY IF EXISTS "Admins view audit logs unless banned" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins view impersonation logs unless banned" ON public.impersonation_logs;
DROP POLICY IF EXISTS "Admins and targets can view impersonation logs" ON public.impersonation_logs;

-- Recreate simple admin policies (no IP checks)
CREATE POLICY "Admins can manage encryption keys"
ON public.encryption_keys FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and targets can view impersonation logs"
ON public.impersonation_logs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = target_user_id
);

-- Drop functions
DROP FUNCTION IF EXISTS public.is_admin_ip_banned();
DROP FUNCTION IF EXISTS public.get_client_ip();

-- Drop table
DROP TABLE IF EXISTS public.admin_ip_banlist;