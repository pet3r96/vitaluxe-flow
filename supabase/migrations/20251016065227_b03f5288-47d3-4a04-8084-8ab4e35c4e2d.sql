-- Create IP ban list table
CREATE TABLE public.admin_ip_banlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  description TEXT,
  banned_reason TEXT NOT NULL,
  banned BOOLEAN NOT NULL DEFAULT true,
  banned_by UUID REFERENCES auth.users(id),
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_ip_banlist ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can manage the ban list
CREATE POLICY "Admins can manage IP ban list"
ON public.admin_ip_banlist
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to get client IP from request headers
CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Try x-real-ip header first (common in proxies)
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-real-ip',
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  );
END;
$$;

-- Function to check if current IP is banned
CREATE OR REPLACE FUNCTION public.is_admin_ip_banned()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_ip_banlist
    WHERE ip_address = public.get_client_ip()
      AND banned = true
  )
$$;

-- Update encryption_keys RLS to include IP check
DROP POLICY IF EXISTS "Admins can manage encryption keys" ON public.encryption_keys;
CREATE POLICY "Admins can manage encryption keys unless IP banned"
ON public.encryption_keys
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_admin_ip_banned()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_admin_ip_banned()
);

-- Update audit_logs RLS to include IP check
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs unless IP banned"
ON public.audit_logs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT is_admin_ip_banned()
);

-- Update impersonation_logs RLS - admin viewing with IP check
DROP POLICY IF EXISTS "Admins and targets can view impersonation logs" ON public.impersonation_logs;
CREATE POLICY "Admins can view impersonation logs unless IP banned"
ON public.impersonation_logs
FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) AND NOT is_admin_ip_banned())
  OR (auth.uid() = target_user_id)
);