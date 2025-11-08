-- Create video usage pricing configuration table
CREATE TABLE IF NOT EXISTS video_usage_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_per_minute NUMERIC(10,2) NOT NULL DEFAULT 0.10,
  included_minutes_per_month INTEGER DEFAULT 0,
  storage_rate_per_gb_per_month NUMERIC(10,2) DEFAULT 0.50,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE video_usage_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can manage pricing
CREATE POLICY "Admins can manage video usage pricing"
ON video_usage_pricing FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add file size tracking to video_sessions
ALTER TABLE video_sessions 
ADD COLUMN IF NOT EXISTS recording_file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS recording_storage_cost NUMERIC(10,2);

-- Create materialized view for monthly usage aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS video_usage_by_practice AS
SELECT 
  vs.practice_id,
  p.name as practice_name,
  p.email as practice_email,
  DATE_TRUNC('month', vs.created_at) as billing_month,
  COUNT(vs.id) as total_sessions,
  SUM(vs.duration_seconds) as total_seconds,
  ROUND(SUM(vs.duration_seconds)::numeric / 60, 2) as total_minutes,
  COUNT(CASE WHEN vs.recording_url IS NOT NULL THEN 1 END) as sessions_with_recordings,
  MIN(vs.created_at) as first_session_date,
  MAX(vs.created_at) as last_session_date,
  COUNT(DISTINCT vs.provider_id) as unique_providers_used,
  COUNT(DISTINCT vs.patient_id) as unique_patients_served
FROM video_sessions vs
LEFT JOIN profiles p ON p.id = vs.practice_id
WHERE vs.duration_seconds IS NOT NULL
GROUP BY vs.practice_id, p.name, p.email, DATE_TRUNC('month', vs.created_at);

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_video_usage_practice_month 
ON video_usage_by_practice(practice_id, billing_month);

-- Grant access to materialized view
GRANT SELECT ON video_usage_by_practice TO authenticated;

-- Create function to calculate billable usage
CREATE OR REPLACE FUNCTION calculate_practice_video_bill(
  p_practice_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_minutes NUMERIC,
  included_minutes INTEGER,
  billable_minutes NUMERIC,
  minute_rate NUMERIC,
  minutes_cost NUMERIC,
  storage_gb NUMERIC,
  storage_cost NUMERIC,
  total_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pricing RECORD;
BEGIN
  -- Get current pricing
  SELECT * INTO v_pricing 
  FROM video_usage_pricing 
  WHERE effective_from <= p_end_date
  ORDER BY effective_from DESC 
  LIMIT 1;
  
  -- Calculate usage
  RETURN QUERY
  SELECT 
    ROUND(SUM(vs.duration_seconds)::numeric / 60, 2) as total_minutes,
    COALESCE(v_pricing.included_minutes_per_month, 0) as included_minutes,
    GREATEST(0, ROUND(SUM(vs.duration_seconds)::numeric / 60, 2) - COALESCE(v_pricing.included_minutes_per_month, 0)) as billable_minutes,
    COALESCE(v_pricing.rate_per_minute, 0.10) as minute_rate,
    GREATEST(0, ROUND(SUM(vs.duration_seconds)::numeric / 60, 2) - COALESCE(v_pricing.included_minutes_per_month, 0)) * COALESCE(v_pricing.rate_per_minute, 0.10) as minutes_cost,
    ROUND(SUM(COALESCE(vs.recording_file_size_bytes, 0))::numeric / 1073741824, 2) as storage_gb,
    ROUND(SUM(COALESCE(vs.recording_file_size_bytes, 0))::numeric / 1073741824, 2) * COALESCE(v_pricing.storage_rate_per_gb_per_month, 0.50) as storage_cost,
    (GREATEST(0, ROUND(SUM(vs.duration_seconds)::numeric / 60, 2) - COALESCE(v_pricing.included_minutes_per_month, 0)) * COALESCE(v_pricing.rate_per_minute, 0.10)) +
    (ROUND(SUM(COALESCE(vs.recording_file_size_bytes, 0))::numeric / 1073741824, 2) * COALESCE(v_pricing.storage_rate_per_gb_per_month, 0.50)) as total_cost
  FROM video_sessions vs
  WHERE vs.practice_id = p_practice_id
    AND vs.created_at >= p_start_date
    AND vs.created_at <= p_end_date
    AND vs.duration_seconds IS NOT NULL;
END;
$$;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_video_usage_by_practice()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY video_usage_by_practice;
END;
$$;

-- Insert default pricing if none exists
INSERT INTO video_usage_pricing (rate_per_minute, included_minutes_per_month, storage_rate_per_gb_per_month, notes)
SELECT 0.10, 100, 0.50, 'Default pricing configuration'
WHERE NOT EXISTS (SELECT 1 FROM video_usage_pricing LIMIT 1);