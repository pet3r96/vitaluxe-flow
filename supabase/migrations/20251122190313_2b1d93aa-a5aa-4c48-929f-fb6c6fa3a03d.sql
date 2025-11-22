-- Create alerts table for appointment notifications
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_alerts_event_type ON public.alerts(event_type);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON public.alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged_at ON public.alerts(acknowledged_at) WHERE acknowledged_at IS NULL;

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (for triggers)
CREATE POLICY "Service role can insert alerts"
  ON public.alerts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins can view all alerts
CREATE POLICY "Admins can view all alerts"
  ON public.alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();