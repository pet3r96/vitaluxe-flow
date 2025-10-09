-- Replace impersonation_logs RLS to avoid referencing auth.users
DO $$ BEGIN
  DROP POLICY IF EXISTS "Only authorized admin can view impersonation logs" ON public.impersonation_logs;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Only authorized admin can update impersonation logs" ON public.impersonation_logs;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin can insert impersonation logs" ON public.impersonation_logs;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- View policy
CREATE POLICY "Admin can view impersonation logs"
ON public.impersonation_logs
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@vitaluxeservice.com');

-- Update policy
CREATE POLICY "Admin can update impersonation logs"
ON public.impersonation_logs
FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@vitaluxeservice.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'admin@vitaluxeservice.com');

-- Insert policy
CREATE POLICY "Admin can insert impersonation logs"
ON public.impersonation_logs
FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') = 'admin@vitaluxeservice.com');