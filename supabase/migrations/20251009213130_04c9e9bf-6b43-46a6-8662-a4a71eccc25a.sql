-- Create impersonation_logs table
CREATE TABLE IF NOT EXISTS public.impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impersonator_email TEXT NOT NULL,
  impersonator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL,
  target_user_email TEXT NOT NULL,
  target_user_name TEXT,
  target_role TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Only the specific admin can view logs
CREATE POLICY "Only authorized admin can view impersonation logs"
  ON public.impersonation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'admin@vitaluxeservice.com'
    )
  );

-- System can insert logs
CREATE POLICY "System can insert impersonation logs"
  ON public.impersonation_logs
  FOR INSERT
  WITH CHECK (true);

-- Only authorized admin can update logs (to set end_time)
CREATE POLICY "Only authorized admin can update impersonation logs"
  ON public.impersonation_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'admin@vitaluxeservice.com'
    )
  );

-- Create index for faster queries
CREATE INDEX idx_impersonation_logs_impersonator ON public.impersonation_logs(impersonator_email);
CREATE INDEX idx_impersonation_logs_target ON public.impersonation_logs(target_user_id);
CREATE INDEX idx_impersonation_logs_start_time ON public.impersonation_logs(start_time DESC);