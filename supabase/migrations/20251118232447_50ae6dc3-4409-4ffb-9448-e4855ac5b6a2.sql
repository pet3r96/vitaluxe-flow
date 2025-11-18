-- Create function to automatically generate subscription commissions
CREATE OR REPLACE FUNCTION public.create_subscription_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription RECORD;
  v_commission_amount DECIMAL(10,2);
BEGIN
  -- Only process if payment is successful
  IF NEW.payment_status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Get subscription details including rep assignment
  SELECT 
    ps.id,
    ps.assigned_rep_id,
    ps.monthly_price,
    ps.rep_commission_percentage
  INTO v_subscription
  FROM practice_subscriptions ps
  WHERE ps.id = NEW.subscription_id;
  
  -- Only create commission if rep is assigned
  IF v_subscription.assigned_rep_id IS NOT NULL THEN
    -- Calculate commission amount
    v_commission_amount := (v_subscription.monthly_price * v_subscription.rep_commission_percentage / 100);
    
    -- Insert commission record (skip if already exists for this payment)
    INSERT INTO rep_subscription_commissions (
      rep_id,
      subscription_id,
      payment_id,
      commission_amount,
      commission_percentage,
      payment_status
    ) VALUES (
      v_subscription.assigned_rep_id,
      NEW.subscription_id,
      NEW.id,
      v_commission_amount,
      v_subscription.rep_commission_percentage,
      'pending'
    )
    ON CONFLICT (payment_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on subscription_payments table
DROP TRIGGER IF EXISTS trigger_create_subscription_commission ON subscription_payments;
CREATE TRIGGER trigger_create_subscription_commission
AFTER INSERT OR UPDATE ON subscription_payments
FOR EACH ROW
EXECUTE FUNCTION public.create_subscription_commission();
