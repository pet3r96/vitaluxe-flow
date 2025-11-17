-------------------------------
-- 3️⃣ pharmacy_shipping_rates (Low Risk)
-------------------------------
ALTER TABLE pharmacy_shipping_rates ENABLE ROW LEVEL SECURITY;

-- Pharmacies can view and update **their own** shipping rates
CREATE POLICY "Pharmacies manage their shipping rates"
  ON pharmacy_shipping_rates
  FOR ALL
  USING (
    pharmacy_id IN (
      SELECT id 
      FROM pharmacies 
      WHERE user_id = auth.uid()
    )
  );

-- Admins full access
CREATE POLICY "Admins manage shipping rates"
  ON pharmacy_shipping_rates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));