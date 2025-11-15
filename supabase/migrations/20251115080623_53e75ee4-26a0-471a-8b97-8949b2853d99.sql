-- Create notifications_sent table for email idempotency
CREATE TABLE IF NOT EXISTS public.notifications_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT notifications_sent_unique_key UNIQUE (event_type, entity_id, recipient)
);

-- Enable RLS
ALTER TABLE public.notifications_sent ENABLE ROW LEVEL SECURITY;

-- Only admins can view notification logs
CREATE POLICY "Admins can view notification logs"
  ON public.notifications_sent
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- System can insert (via service role)
CREATE POLICY "Service role can insert"
  ON public.notifications_sent
  FOR INSERT
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_sent_lookup 
  ON public.notifications_sent (event_type, entity_id, recipient);

CREATE INDEX IF NOT EXISTS idx_notifications_sent_sent_at 
  ON public.notifications_sent (sent_at DESC);