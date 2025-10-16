-- 1. Create shipping_speed enum
CREATE TYPE shipping_speed AS ENUM ('ground', '2day', 'overnight');

-- 2. Create pharmacy_shipping_rates table
CREATE TABLE pharmacy_shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  shipping_speed shipping_speed NOT NULL,
  rate NUMERIC(10,2) NOT NULL CHECK (rate >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pharmacy_id, shipping_speed)
);

-- 3. Add shipping_speed to cart_lines
ALTER TABLE cart_lines
  ADD COLUMN shipping_speed shipping_speed DEFAULT 'ground';

-- 4. Add shipping fields to order_lines
ALTER TABLE order_lines
  ADD COLUMN shipping_speed shipping_speed NOT NULL DEFAULT 'ground',
  ADD COLUMN shipping_cost NUMERIC(10,2) DEFAULT 0;

-- 5. Add shipping_total to orders
ALTER TABLE orders
  ADD COLUMN shipping_total NUMERIC(10,2) DEFAULT 0;

-- 6. Insert default rates for existing pharmacies
-- Test Pharma (22e7801e-f9ff-40f1-a926-968f3a8065ec)
INSERT INTO pharmacy_shipping_rates (pharmacy_id, shipping_speed, rate) VALUES
  ('22e7801e-f9ff-40f1-a926-968f3a8065ec', 'ground', 9.99),
  ('22e7801e-f9ff-40f1-a926-968f3a8065ec', '2day', 19.99),
  ('22e7801e-f9ff-40f1-a926-968f3a8065ec', 'overnight', 29.99);

-- test 2 pharmacy (3cfda079-b558-46f3-b3fc-23a62a901987)
INSERT INTO pharmacy_shipping_rates (pharmacy_id, shipping_speed, rate) VALUES
  ('3cfda079-b558-46f3-b3fc-23a62a901987', 'ground', 9.99),
  ('3cfda079-b558-46f3-b3fc-23a62a901987', '2day', 19.99),
  ('3cfda079-b558-46f3-b3fc-23a62a901987', 'overnight', 29.99);

-- 7. RLS Policies for pharmacy_shipping_rates
ALTER TABLE pharmacy_shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage shipping rates"
  ON pharmacy_shipping_rates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view shipping rates"
  ON pharmacy_shipping_rates FOR SELECT
  USING (true);

-- 8. Trigger for updated_at
CREATE TRIGGER update_pharmacy_shipping_rates_updated_at
  BEFORE UPDATE ON pharmacy_shipping_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();