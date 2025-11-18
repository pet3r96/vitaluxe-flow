-- Create performance_metrics table for tracking page load times and web vitals
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_role TEXT,
  load_time_ms NUMERIC NOT NULL,
  metric_type TEXT NOT NULL, -- 'page_load', 'interaction', 'FCP', 'LCP', 'FID', 'CLS', 'TTFB'
  metric_value NUMERIC,
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  connection_type TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_page_name ON public.performance_metrics(page_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON public.performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_type ON public.performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON public.performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_composite ON public.performance_metrics(page_name, metric_type, timestamp DESC);

-- Enable RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can view all metrics (using user_roles table)
CREATE POLICY "Admin can view all performance metrics"
  ON public.performance_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: All authenticated users can insert their own metrics
CREATE POLICY "Users can insert performance metrics"
  ON public.performance_metrics
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Anonymous users can insert metrics (for public pages like login)
CREATE POLICY "Anonymous users can insert performance metrics"
  ON public.performance_metrics
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.performance_metrics IS 'Stores performance monitoring data including page load times and web vitals';
COMMENT ON COLUMN public.performance_metrics.metric_type IS 'Type of metric: page_load, interaction, FCP, LCP, FID, CLS, TTFB';
COMMENT ON COLUMN public.performance_metrics.load_time_ms IS 'Primary metric value in milliseconds';