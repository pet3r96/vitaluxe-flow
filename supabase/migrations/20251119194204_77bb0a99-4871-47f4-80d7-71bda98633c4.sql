-- Phase 3: Add patient_id to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patient_accounts(id);

-- Create order summary view for support tickets and order lists
CREATE OR REPLACE VIEW v_order_summary AS
SELECT
  o.id,
  o.practice_id,
  o.patient_id,
  COALESCE(pa.first_name || ' ' || pa.last_name, pa.name) AS patient_name,
  pa.email AS patient_email,
  o.total_amount,
  o.status,
  o.payment_status,
  o.created_at,
  o.doctor_id
FROM orders o
LEFT JOIN patient_accounts pa ON pa.id = o.patient_id;