-- Add voided status support to practice development fee invoices
ALTER TABLE practice_development_fee_invoices
ADD COLUMN voided_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN voided_by UUID REFERENCES auth.users(id),
ADD COLUMN void_reason TEXT;

-- Update payment_status check constraint to include 'voided'
ALTER TABLE practice_development_fee_invoices 
DROP CONSTRAINT IF EXISTS practice_development_fee_invoices_payment_status_check;

ALTER TABLE practice_development_fee_invoices
ADD CONSTRAINT practice_development_fee_invoices_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'voided'));