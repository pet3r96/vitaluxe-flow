-- Add status tracking to alerts table
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON public.alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON public.alerts(triggered_at DESC);