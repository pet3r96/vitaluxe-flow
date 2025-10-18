-- Create table to track Amazon tracking API calls for rate limiting
CREATE TABLE IF NOT EXISTS public.amazon_tracking_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id uuid NOT NULL REFERENCES public.order_lines(id) ON DELETE CASCADE,
  tracking_number text NOT NULL,
  called_by uuid REFERENCES auth.users(id),
  called_at timestamp with time zone NOT NULL DEFAULT now(),
  response_status text NOT NULL DEFAULT 'success',
  api_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups by order_line
CREATE INDEX IF NOT EXISTS idx_tracking_calls_order_line 
ON public.amazon_tracking_api_calls(order_line_id, called_at DESC);

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_tracking_calls_user
ON public.amazon_tracking_api_calls(called_by, called_at DESC);

-- Enable RLS
ALTER TABLE public.amazon_tracking_api_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all tracking API calls"
ON public.amazon_tracking_api_calls FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert tracking API calls"
ON public.amazon_tracking_api_calls FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create configuration table for API rate limits
CREATE TABLE IF NOT EXISTS public.api_rate_limits_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL UNIQUE,
  max_calls_per_day integer NOT NULL DEFAULT 3,
  max_calls_per_hour integer,
  cost_per_call numeric(10,4),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_rate_limits_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for config
CREATE POLICY "Everyone can view rate limit configs"
ON public.api_rate_limits_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage rate limit configs"
ON public.api_rate_limits_config FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default configuration for Amazon tracking
INSERT INTO public.api_rate_limits_config (api_name, max_calls_per_day, max_calls_per_hour, cost_per_call)
VALUES ('amazon_tracking', 3, NULL, 0.05)
ON CONFLICT (api_name) DO NOTHING;