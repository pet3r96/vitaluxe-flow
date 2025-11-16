-- Add missing columns to order_profits
ALTER TABLE order_profits
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Fix rep_payment_batches - ensure batch_number column exists
-- (it should already exist from previous migration, this is idempotent)

-- Create practice_subscriptions table
CREATE TABLE IF NOT EXISTS practice_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  subscription_tier text NOT NULL,
  rep_commission_percentage numeric DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create api_rate_limits_config and amazon_tracking_api_calls tables
CREATE TABLE IF NOT EXISTS api_rate_limits_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  cost_per_call numeric NOT NULL DEFAULT 0,
  rate_limit integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS amazon_tracking_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now(),
  response_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_sync_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS practice_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE practice_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_tracking_api_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_rooms ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Admins can manage all" ON practice_subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'super_admin'))
);

CREATE POLICY "Admins can view all" ON api_rate_limits_config FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'super_admin'))
);

CREATE POLICY "Admins can manage all" ON amazon_tracking_api_calls FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'super_admin'))
);

CREATE POLICY "Users can manage their own tokens" ON calendar_sync_tokens FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Practices can manage their rooms" ON practice_rooms FOR ALL USING (practice_id = auth.uid());