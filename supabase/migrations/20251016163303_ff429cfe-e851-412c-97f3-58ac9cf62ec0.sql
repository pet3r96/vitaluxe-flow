-- Migration 1: Extend Orders Table for Payment Tracking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS authorizenet_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS authorizenet_profile_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method_used TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.practice_payment_methods(id),
ADD COLUMN IF NOT EXISTS total_refunded_amount DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_authorizenet_transaction_id ON public.orders(authorizenet_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method_id ON public.orders(payment_method_id);

-- Migration 2: Extend Payment Methods Table
ALTER TABLE public.practice_payment_methods
ADD COLUMN IF NOT EXISTS authorizenet_profile_id TEXT,
ADD COLUMN IF NOT EXISTS authorizenet_payment_profile_id TEXT,
ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'bank_account',
ADD COLUMN IF NOT EXISTS card_type TEXT,
ADD COLUMN IF NOT EXISTS card_last_five TEXT,
ADD COLUMN IF NOT EXISTS card_expiry TEXT,
ADD COLUMN IF NOT EXISTS account_last_five TEXT,
ADD COLUMN IF NOT EXISTS account_type TEXT,
ADD COLUMN IF NOT EXISTS routing_number_last_four TEXT,
ADD COLUMN IF NOT EXISTS billing_street TEXT,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_zip TEXT,
ADD COLUMN IF NOT EXISTS billing_country TEXT DEFAULT 'US';

-- Update existing Plaid accounts to have last 5 digits
UPDATE public.practice_payment_methods
SET account_last_five = RIGHT(account_mask, 5),
    payment_type = 'bank_account'
WHERE account_mask IS NOT NULL AND account_last_five IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_authorizenet_profile ON public.practice_payment_methods(authorizenet_profile_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_payment_type ON public.practice_payment_methods(payment_type);

-- Migration 3: Add Billing Address to Profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS billing_street TEXT,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_zip TEXT,
ADD COLUMN IF NOT EXISTS billing_country TEXT DEFAULT 'US';

-- Migration 4: Create Order Refunds Table
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  refund_transaction_id TEXT NOT NULL,
  original_transaction_id TEXT NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL,
  refund_reason TEXT,
  refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'partial')),
  refunded_by UUID REFERENCES auth.users(id),
  refund_status TEXT NOT NULL DEFAULT 'pending' CHECK (refund_status IN ('pending', 'approved', 'declined', 'error')),
  authorizenet_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all refunds" ON public.order_refunds;
DROP POLICY IF EXISTS "System can insert refunds" ON public.order_refunds;
DROP POLICY IF EXISTS "Admins can update refunds" ON public.order_refunds;

-- RLS Policies
CREATE POLICY "Admins can view all refunds"
ON public.order_refunds FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert refunds"
ON public.order_refunds FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update refunds"
ON public.order_refunds FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON public.order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_status ON public.order_refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_order_refunds_transaction_id ON public.order_refunds(refund_transaction_id);

-- Check constraint for positive refund amounts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_refund_amount_positive'
  ) THEN
    ALTER TABLE public.order_refunds
    ADD CONSTRAINT check_refund_amount_positive 
    CHECK (refund_amount > 0);
  END IF;
END $$;

-- Trigger to update order payment_status on refund approval
CREATE OR REPLACE FUNCTION update_order_payment_status_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.refund_status = 'approved' AND NEW.refund_type = 'full' THEN
    UPDATE orders
    SET payment_status = 'refunded',
        total_refunded_amount = total_amount,
        updated_at = now()
    WHERE id = NEW.order_id;
  ELSIF NEW.refund_status = 'approved' AND NEW.refund_type = 'partial' THEN
    UPDATE orders
    SET payment_status = 'partially_refunded',
        total_refunded_amount = COALESCE(total_refunded_amount, 0) + NEW.refund_amount,
        updated_at = now()
    WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_refund_approved ON public.order_refunds;

CREATE TRIGGER on_refund_approved
AFTER UPDATE OF refund_status ON public.order_refunds
FOR EACH ROW
WHEN (NEW.refund_status = 'approved' AND OLD.refund_status != 'approved')
EXECUTE FUNCTION update_order_payment_status_on_refund();