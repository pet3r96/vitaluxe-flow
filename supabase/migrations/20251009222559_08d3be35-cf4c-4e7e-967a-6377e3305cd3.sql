-- Fix impersonation_logs RLS policies to allow admin to insert
DROP POLICY IF EXISTS "System can insert impersonation logs" ON public.impersonation_logs;

CREATE POLICY "Admin can insert impersonation logs"
ON public.impersonation_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE users.id = auth.uid() 
    AND users.email = 'admin@vitaluxeservice.com'
  )
);