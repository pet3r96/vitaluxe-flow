-- ============================================
-- CRITICAL FIX: Create notification_logs table
-- Required for email/SMS delivery tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'in_app')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  external_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX idx_notification_logs_channel ON public.notification_logs(channel);
CREATE INDEX idx_notification_logs_status ON public.notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON public.notification_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Service role policy (edge functions need full access)
CREATE POLICY "notification_logs_service_role_all"
ON public.notification_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own logs
CREATE POLICY "Users can view own notification logs"
ON public.notification_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all logs
CREATE POLICY "Admins can view all notification logs"
ON public.notification_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  )
);

COMMENT ON TABLE public.notification_logs IS 'Tracks all email/SMS delivery attempts for audit and debugging';
COMMENT ON COLUMN public.notification_logs.external_id IS 'Postmark MessageID or Twilio SID';
COMMENT ON COLUMN public.notification_logs.channel IS 'Delivery channel: email, sms, or in_app';