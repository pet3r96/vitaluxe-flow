-- ============================================
-- CRITICAL FIX: Create notifications_sent table
-- Required for idempotency checks (prevent duplicate sends)
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index to prevent duplicate sends
CREATE UNIQUE INDEX idx_notifications_sent_unique 
ON public.notifications_sent(event_type, entity_id, recipient);

-- Create indexes for performance
CREATE INDEX idx_notifications_sent_event_type ON public.notifications_sent(event_type);
CREATE INDEX idx_notifications_sent_entity_id ON public.notifications_sent(entity_id);
CREATE INDEX idx_notifications_sent_sent_at ON public.notifications_sent(sent_at DESC);

-- Enable RLS
ALTER TABLE public.notifications_sent ENABLE ROW LEVEL SECURITY;

-- Service role policy (edge functions need full access for idempotency checks)
CREATE POLICY "notifications_sent_service_role_all"
ON public.notifications_sent
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can view all sent notifications
CREATE POLICY "Admins can view all sent notifications"
ON public.notifications_sent
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  )
);

COMMENT ON TABLE public.notifications_sent IS 'Tracks successfully sent notifications to prevent duplicates (idempotency)';
COMMENT ON COLUMN public.notifications_sent.message_id IS 'External API message ID (Postmark or Twilio)';
COMMENT ON COLUMN public.notifications_sent.metadata IS 'Additional context about the notification';