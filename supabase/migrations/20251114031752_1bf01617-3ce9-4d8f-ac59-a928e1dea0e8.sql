-- ============================================================================
-- PERFORMANCE OPTIMIZATION: Database Indexes for Lightning-Fast Queries
-- ============================================================================
-- Orders Performance
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC);

-- Order Lines Performance  
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_status ON order_lines (status, created_at DESC);

-- Rep Productivity Performance
CREATE INDEX IF NOT EXISTS idx_reps_user_id_role ON reps (user_id, role);
CREATE INDEX IF NOT EXISTS idx_commissions_rep_created ON commissions (rep_id, created_at DESC);

-- Cart Performance
CREATE INDEX IF NOT EXISTS idx_cart_lines_cart_id ON cart_lines (cart_id);

-- Patient Accounts Performance
CREATE INDEX IF NOT EXISTS idx_patient_accounts_created ON patient_accounts (created_at DESC);

-- Pharmacy Shipping Rates
CREATE INDEX IF NOT EXISTS idx_pharmacy_shipping_rates_pharmacy_enabled ON pharmacy_shipping_rates (pharmacy_id, enabled);

-- Update statistics for query planner
ANALYZE orders;
ANALYZE order_lines;
ANALYZE reps;
ANALYZE commissions;
ANALYZE cart_lines;
ANALYZE cart;
ANALYZE patient_accounts;
ANALYZE pharmacy_shipping_rates;