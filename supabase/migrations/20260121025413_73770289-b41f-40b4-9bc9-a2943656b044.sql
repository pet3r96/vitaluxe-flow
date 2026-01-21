-- Create webhook event log table for auditing and replay
CREATE TABLE public.pharmacy_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id),
  webhook_path TEXT,
  request_headers JSONB,
  raw_payload JSONB NOT NULL,
  transformed_payload JSONB,
  order_line_id UUID REFERENCES public.order_lines(id),
  status_code INTEGER NOT NULL,
  response_body JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  is_duplicate BOOLEAN DEFAULT FALSE,
  replayed_from_event_id UUID REFERENCES public.pharmacy_webhook_events(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_pharmacy_webhook_events_pharmacy_id ON public.pharmacy_webhook_events(pharmacy_id);
CREATE INDEX idx_pharmacy_webhook_events_order_line_id ON public.pharmacy_webhook_events(order_line_id);
CREATE INDEX idx_pharmacy_webhook_events_created_at ON public.pharmacy_webhook_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.pharmacy_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events (using user_roles table)
CREATE POLICY "Admins can view webhook events"
ON public.pharmacy_webhook_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Only admins can insert (for replay)
CREATE POLICY "Admins can insert webhook events"
ON public.pharmacy_webhook_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Add last_status_update_at to order_lines for idempotency checks
ALTER TABLE public.order_lines 
ADD COLUMN IF NOT EXISTS last_status_update_at TIMESTAMP WITH TIME ZONE;

-- Add index for status history on pharmacy_tracking_updates
CREATE INDEX IF NOT EXISTS idx_pharmacy_tracking_updates_order_line 
ON public.pharmacy_tracking_updates(order_line_id, created_at DESC);

COMMENT ON TABLE public.pharmacy_webhook_events IS 'Audit log of all incoming pharmacy webhooks for debugging and replay';
COMMENT ON COLUMN public.pharmacy_webhook_events.is_duplicate IS 'True if webhook was a duplicate based on idempotency check';
COMMENT ON COLUMN public.pharmacy_webhook_events.replayed_from_event_id IS 'If this event was manually replayed, references the original event';