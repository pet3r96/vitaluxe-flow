-- ================================================================
-- BATCH: FIX MISSING SELECT POLICIES ON 7 TABLES
-- Do NOT drop or modify existing policies.
-- Only ADD minimal SELECT coverage.
-- ================================================================

-------------------------------
-- 1. cart (practice+staff)
-------------------------------
CREATE POLICY "Practice view own cart"
  ON cart
  FOR SELECT
  TO authenticated
  USING (doctor_id = auth.uid());

-------------------------------
-- 2. admin_alerts (admin-only)
-------------------------------
CREATE POLICY "Admins view alerts"
  ON admin_alerts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-------------------------------
-- 3. admin_ip_banlist (admin-only)
-------------------------------
CREATE POLICY "Admins view IP banlist"
  ON admin_ip_banlist
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-------------------------------
-- 4. amazon_tracking_api_calls (admin-only)
-------------------------------
CREATE POLICY "Admins view tracking calls"
  ON amazon_tracking_api_calls
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-------------------------------
-- 5. calendar_sync_tokens (user-only)
-------------------------------
CREATE POLICY "Users view own calendar tokens"
  ON calendar_sync_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-------------------------------
-- 6. pharmacy_shipping_rates (pharmacy + admin)
-------------------------------
CREATE POLICY "Pharmacy view shipping rates"
  ON pharmacy_shipping_rates
  FOR SELECT
  TO authenticated
  USING (pharmacy_id = auth.uid());

CREATE POLICY "Admins view shipping rates"
  ON pharmacy_shipping_rates
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-------------------------------
-- 7. function_rate_limits (admin + owner)
-------------------------------
CREATE POLICY "Users view own rate-limit logs"
  ON function_rate_limits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all rate-limit logs"
  ON function_rate_limits
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));