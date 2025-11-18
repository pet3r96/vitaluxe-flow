-- Dashboard Performance Optimization Indexes
-- Add composite indexes for faster dashboard queries

-- 1. Orders dashboard lookup (doctor_id + status filters + date sorting)
CREATE INDEX IF NOT EXISTS idx_orders_doctor_dashboard 
  ON orders(doctor_id, created_at DESC, status, payment_status)
  WHERE status != 'cancelled' AND payment_status != 'payment_failed';

-- 2. Provider user_id lookup
CREATE INDEX IF NOT EXISTS idx_providers_user_id 
  ON providers(user_id);

-- 3. Pharmacy user_id lookup  
CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id 
  ON pharmacies(user_id);

-- 4. Product pharmacies lookup
CREATE INDEX IF NOT EXISTS idx_product_pharmacies_pharmacy 
  ON product_pharmacies(pharmacy_id);

-- 5. Order lines with provider filter (for provider dashboard)
CREATE INDEX IF NOT EXISTS idx_order_lines_provider_id
  ON order_lines(provider_id);