-- Create order_profits table
CREATE TABLE IF NOT EXISTS order_profits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  topline_id uuid NOT NULL,
  topline_profit numeric NOT NULL DEFAULT 0,
  downline_id uuid,
  downline_profit numeric DEFAULT 0,
  order_total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create rep_payment_batches table
CREATE TABLE IF NOT EXISTS rep_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topline_rep_id uuid NOT NULL,
  batch_number text NOT NULL,
  total_amount numeric NOT NULL,
  payment_status text DEFAULT 'pending',
  payment_date timestamptz,
  payment_method text,
  date_range_start timestamptz NOT NULL,
  date_range_end timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create rep_payments table
CREATE TABLE IF NOT EXISTS rep_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid,
  topline_rep_id uuid NOT NULL,
  amount_paid numeric NOT NULL,
  profit_ids uuid[] NOT NULL,
  date_range_start timestamptz NOT NULL,
  date_range_end timestamptz NOT NULL,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing column to rep_subscription_commissions
ALTER TABLE rep_subscription_commissions
  ADD COLUMN IF NOT EXISTS practice_subscription_id uuid;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_order_profits_order ON order_profits(order_id);
CREATE INDEX IF NOT EXISTS idx_order_profits_topline ON order_profits(topline_id);
CREATE INDEX IF NOT EXISTS idx_rep_payment_batches_rep ON rep_payment_batches(topline_rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_payments_batch ON rep_payments(batch_id);
CREATE INDEX IF NOT EXISTS idx_rep_payments_rep ON rep_payments(topline_rep_id);

-- Enable RLS
ALTER TABLE order_profits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Toplines can view their own profits"
  ON order_profits FOR SELECT
  USING (topline_id = auth.uid() OR downline_id = auth.uid());

CREATE POLICY "Admins can manage all profits"
  ON order_profits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Reps can view their own payment batches"
  ON rep_payment_batches FOR SELECT
  USING (topline_rep_id = auth.uid());

CREATE POLICY "Admins can manage all payment batches"
  ON rep_payment_batches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Reps can view their own payments"
  ON rep_payments FOR SELECT
  USING (topline_rep_id = auth.uid());

CREATE POLICY "Admins can manage all payments"
  ON rep_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );