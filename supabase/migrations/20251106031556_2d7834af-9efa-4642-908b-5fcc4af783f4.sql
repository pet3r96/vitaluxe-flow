-- Enable RLS on role_cleanup_log table
ALTER TABLE public.role_cleanup_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy for viewing logs
CREATE POLICY "Admins can view role cleanup logs"
  ON public.role_cleanup_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- System can insert logs (no user context required for system operations)
CREATE POLICY "System can insert role cleanup logs"
  ON public.role_cleanup_log
  FOR INSERT
  WITH CHECK (true);