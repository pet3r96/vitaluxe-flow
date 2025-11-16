-- Add missing columns to two_fa_audit_log
ALTER TABLE two_fa_audit_log
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS code_verified boolean,
  ADD COLUMN IF NOT EXISTS attempt_count integer;

-- Create rep_subscription_commissions table
CREATE TABLE IF NOT EXISTS rep_subscription_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  commission_amount numeric NOT NULL,
  commission_type text NOT NULL,
  billing_month text NOT NULL,
  payment_status text DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  practice_id uuid NOT NULL,
  amount numeric NOT NULL,
  billing_month text NOT NULL,
  payment_date timestamptz,
  payment_status text DEFAULT 'pending',
  payment_method text,
  transaction_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_rep_commissions_rep ON rep_subscription_commissions(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_commissions_subscription ON rep_subscription_commissions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_practice ON subscription_payments(practice_id);

-- Enable RLS
ALTER TABLE rep_subscription_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Reps can view their own commissions"
  ON rep_subscription_commissions FOR SELECT
  USING (rep_id = auth.uid());

CREATE POLICY "Admins can manage all commissions"
  ON rep_subscription_commissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Practices can view their subscription payments"
  ON subscription_payments FOR SELECT
  USING (practice_id = auth.uid());

CREATE POLICY "Admins can manage all subscription payments"
  ON subscription_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );