-- =====================================================
-- PHASE 3: PENETRATION TEST RESULTS TABLE
-- =====================================================

-- Create table to store penetration test results
CREATE TABLE IF NOT EXISTS public.penetration_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  test_category TEXT NOT NULL, -- 'RLS', 'Storage', 'Edge Function', 'Video', 'JWT'
  attack_vector TEXT NOT NULL,
  target_function TEXT,
  target_table TEXT,
  target_bucket TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID,
  practice_id UUID,
  success BOOLEAN NOT NULL,
  expected_result TEXT NOT NULL,
  actual_result TEXT NOT NULL,
  sql_trace TEXT,
  error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.penetration_test_results ENABLE ROW LEVEL SECURITY;

-- Admin-only access to test results
CREATE POLICY "Admins can view all test results"
ON public.penetration_test_results
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert test results"
ON public.penetration_test_results
FOR INSERT
WITH CHECK (true); -- Edge functions insert with service role

-- Create index for querying test results
CREATE INDEX idx_penetration_test_results_category ON public.penetration_test_results(test_category);
CREATE INDEX idx_penetration_test_results_timestamp ON public.penetration_test_results(timestamp DESC);
CREATE INDEX idx_penetration_test_results_success ON public.penetration_test_results(success);

-- Create view for test summary
CREATE OR REPLACE VIEW public.penetration_test_summary AS
SELECT 
  test_category,
  COUNT(*) as total_tests,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as failed_tests,
  ROUND(100.0 * SUM(CASE WHEN success = false THEN 1 ELSE 0 END) / COUNT(*), 2) as pass_rate
FROM public.penetration_test_results
GROUP BY test_category;

COMMENT ON TABLE public.penetration_test_results IS 'Stores results from automated security penetration tests';
COMMENT ON VIEW public.penetration_test_summary IS 'Summary statistics of penetration test results by category';