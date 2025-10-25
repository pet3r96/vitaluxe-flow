-- Create easypost_tracking_events table
CREATE TABLE IF NOT EXISTS public.easypost_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Tracking identifiers
  easypost_tracker_id TEXT NOT NULL,
  order_line_id UUID NOT NULL REFERENCES public.order_lines(id) ON DELETE CASCADE,
  
  -- Event details
  status TEXT NOT NULL,
  message TEXT,
  description TEXT,
  carrier TEXT,
  tracking_details JSONB,
  event_time TIMESTAMPTZ NOT NULL,
  
  -- Unique constraint to prevent duplicate events
  CONSTRAINT unique_tracking_event UNIQUE (easypost_tracker_id, order_line_id, event_time)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_easypost_events_order_line 
  ON public.easypost_tracking_events(order_line_id);
CREATE INDEX IF NOT EXISTS idx_easypost_events_tracker 
  ON public.easypost_tracking_events(easypost_tracker_id);
CREATE INDEX IF NOT EXISTS idx_easypost_events_time 
  ON public.easypost_tracking_events(event_time DESC);

-- Enable RLS
ALTER TABLE public.easypost_tracking_events ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access to tracking events"
  ON public.easypost_tracking_events
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Pharmacy can view tracking events for their assigned orders
CREATE POLICY "Pharmacy can view their tracking events"
  ON public.easypost_tracking_events
  FOR SELECT
  USING (
    has_role(auth.uid(), 'pharmacy'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.order_lines ol
      WHERE ol.id = order_line_id
      AND ol.assigned_pharmacy_id IN (
        SELECT id FROM public.pharmacies WHERE user_id = auth.uid()
      )
    )
  );

-- Doctors can view tracking events for their orders
CREATE POLICY "Doctor can view their practice tracking events"
  ON public.easypost_tracking_events
  FOR SELECT
  USING (
    has_role(auth.uid(), 'doctor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.order_lines ol
      JOIN public.orders o ON ol.order_id = o.id
      WHERE ol.id = order_line_id
      AND o.doctor_id = auth.uid()
    )
  );

-- System can insert tracking events
CREATE POLICY "System can insert tracking events"
  ON public.easypost_tracking_events
  FOR INSERT
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.easypost_tracking_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();