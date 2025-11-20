-- Add RLS policy for pharmacy_shipping_rates to allow authenticated users to view enabled rates
-- This fixes the "No Shipping Available" error

-- Check if the policy already exists, drop if it does
DROP POLICY IF EXISTS "authenticated_users_view_shipping_rates" ON pharmacy_shipping_rates;

-- Create new policy to allow all authenticated users to view enabled shipping rates
CREATE POLICY "authenticated_users_view_shipping_rates"
  ON pharmacy_shipping_rates FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND enabled = true
  );

COMMENT ON POLICY "authenticated_users_view_shipping_rates" ON pharmacy_shipping_rates IS 
'Allows all authenticated users to view enabled shipping rates when checking out. This ensures shipping options are visible during the checkout process.';