-- Add payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'completed');

-- Create rep_payment_batches table first
CREATE TABLE rep_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL UNIQUE,
  paid_by uuid NOT NULL,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  total_amount numeric(10,2) NOT NULL,
  payment_method text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_rep_payment_batches_date ON rep_payment_batches(payment_date);
CREATE INDEX idx_rep_payment_batches_paid_by ON rep_payment_batches(paid_by);

ALTER TABLE rep_payment_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment batches"
ON rep_payment_batches FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create rep_payments table second
CREATE TABLE rep_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES rep_payment_batches(id) ON DELETE CASCADE,
  topline_rep_id uuid REFERENCES reps(id) NOT NULL,
  amount_paid numeric(10,2) NOT NULL,
  profit_ids uuid[] NOT NULL,
  date_range_start timestamp with time zone NOT NULL,
  date_range_end timestamp with time zone NOT NULL,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_rep_payments_topline ON rep_payments(topline_rep_id);
CREATE INDEX idx_rep_payments_batch ON rep_payments(batch_id);
CREATE INDEX idx_rep_payments_date ON rep_payments(paid_at);

ALTER TABLE rep_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all rep payments"
ON rep_payments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert rep payments"
ON rep_payments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Toplines can view their own payments"
ON rep_payments FOR SELECT
USING (
  topline_rep_id IN (
    SELECT id FROM reps WHERE user_id = auth.uid() AND role = 'topline'
  )
);

-- Now add columns to order_profits that reference rep_payments
ALTER TABLE order_profits 
ADD COLUMN payment_status payment_status DEFAULT 'pending' NOT NULL,
ADD COLUMN paid_at timestamp with time zone,
ADD COLUMN payment_id uuid REFERENCES rep_payments(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX idx_order_profits_payment_status ON order_profits(payment_status);
CREATE INDEX idx_order_profits_paid_at ON order_profits(paid_at);
CREATE INDEX idx_order_profits_payment_id ON order_profits(payment_id);