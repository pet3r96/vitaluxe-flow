-- Add payment tracking columns to rep_subscription_commissions
ALTER TABLE rep_subscription_commissions 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_notes text,
ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_rep_subscription_commissions_payment_status 
ON rep_subscription_commissions(payment_status);

CREATE INDEX IF NOT EXISTS idx_rep_subscription_commissions_rep_id 
ON rep_subscription_commissions(rep_id);

-- Add comments explaining the columns
COMMENT ON COLUMN rep_subscription_commissions.payment_status IS 'Payout status: pending (awaiting payment), paid (commission paid out), cancelled (subscription cancelled before payout)';
COMMENT ON COLUMN rep_subscription_commissions.payment_method IS 'Method used to pay the rep (e.g., wire transfer, check, PayPal)';
COMMENT ON COLUMN rep_subscription_commissions.payment_notes IS 'Admin notes about the payment';
COMMENT ON COLUMN rep_subscription_commissions.paid_by IS 'Admin user who processed the payment';
COMMENT ON COLUMN rep_subscription_commissions.paid_at IS 'Timestamp when the commission was marked as paid';