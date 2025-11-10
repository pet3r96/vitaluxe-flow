-- Drop conflicting function versions
DROP FUNCTION IF EXISTS create_practice_subscription(uuid, boolean);
DROP FUNCTION IF EXISTS create_practice_subscription(uuid);

-- Create single canonical version with 14-day trial
CREATE OR REPLACE FUNCTION create_practice_subscription(
  p_practice_id UUID,
  p_start_trial BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  -- Calculate trial end date (14 days from now)
  IF p_start_trial THEN
    v_trial_ends_at := NOW() + INTERVAL '14 days';
  END IF;

  -- Insert new subscription
  INSERT INTO practice_subscriptions (
    practice_id,
    status,
    trial_start_at,
    trial_ends_at,
    monthly_price,
    rep_commission_percentage
  ) VALUES (
    p_practice_id,
    CASE WHEN p_start_trial THEN 'trial'::text ELSE 'active'::text END,
    CASE WHEN p_start_trial THEN NOW() ELSE NULL END,
    v_trial_ends_at,
    149.99,
    0.00
  )
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$;

-- Add constraint to ensure trial periods are always 14 days
CREATE OR REPLACE FUNCTION validate_trial_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'trial' AND NEW.trial_start_at IS NOT NULL AND NEW.trial_ends_at IS NOT NULL THEN
    -- Ensure trial period is 14 days (allow small time variance for existing records)
    IF NEW.trial_ends_at < NEW.trial_start_at + INTERVAL '13 days' 
       OR NEW.trial_ends_at > NEW.trial_start_at + INTERVAL '15 days' THEN
      RAISE EXCEPTION 'Trial period must be 14 days. Got: % to %', NEW.trial_start_at, NEW.trial_ends_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new subscriptions only (not updates to avoid blocking existing data)
DROP TRIGGER IF EXISTS check_trial_period ON practice_subscriptions;
CREATE TRIGGER check_trial_period
  BEFORE INSERT ON practice_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION validate_trial_period();