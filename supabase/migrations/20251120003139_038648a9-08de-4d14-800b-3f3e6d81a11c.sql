-- Phase 1: Fix Product Price 400 Errors
-- Allow doctors, providers, and staff to VIEW price overrides
-- This fixes the 400 errors when loading product prices

CREATE POLICY "practice_staff_view_price_overrides"
  ON rep_product_price_overrides FOR SELECT
  USING (
    -- Allow if user is a doctor, provider, or staff
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('doctor', 'provider', 'staff')
    )
    -- OR if they're a rep viewing their own overrides
    OR rep_user_id = auth.uid()
    -- OR if they're an admin
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON POLICY "practice_staff_view_price_overrides" ON rep_product_price_overrides IS 
'Allows doctors, providers, and staff to view rep price overrides when displaying product prices. Fixes 400 errors on product pages.';

-- Phase 2: Fix "No Shipping Available" Error
-- Enable Ground and 2-Day shipping for Demo Pharmacy 1

UPDATE pharmacy_shipping_rates
SET 
  enabled = true,
  rate = CASE 
    WHEN shipping_speed = 'ground' THEN 8.00    -- Standard ground rate
    WHEN shipping_speed = '2day' THEN 15.00     -- Standard 2-day rate
    ELSE rate                                     -- Keep overnight at $35
  END
WHERE pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c' -- Demo Pharmacy 1
  AND shipping_speed IN ('ground', '2day');