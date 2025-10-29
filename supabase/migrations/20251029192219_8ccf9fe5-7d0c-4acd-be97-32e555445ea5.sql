-- Update subscription pricing from $250 to $99.99/month
-- This migration updates both the default value for new subscriptions
-- and all existing subscription records

-- Update default value for monthly_price column
ALTER TABLE public.practice_subscriptions 
ALTER COLUMN monthly_price SET DEFAULT 99.99;

-- Update existing subscriptions that have the old prices
-- This updates both $250.00 and the old $99.00 default to the new $99.99
UPDATE public.practice_subscriptions 
SET monthly_price = 99.99 
WHERE monthly_price = 250.00 OR monthly_price = 99.00;

-- Update terms and conditions to reflect new pricing
UPDATE public.terms_and_conditions
SET 
  content = REPLACE(
    REPLACE(content, '$250 per month', '$99.99 per month plus applicable processing fees'),
    'Subscription Fee: $250', 'Subscription Fee: $99.99 plus applicable processing fees'
  ),
  version = version + 1,
  updated_at = NOW()
WHERE role = 'subscription';