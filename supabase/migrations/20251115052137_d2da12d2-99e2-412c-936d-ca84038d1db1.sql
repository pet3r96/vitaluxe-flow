-- ============================================================================
-- ORDERS PERFORMANCE OPTIMIZATION INDEXES
-- Adds 3 new indexes to improve query performance across all roles
-- ============================================================================

-- 1. Rep Practice Links - speeds up topline/downline lookups
CREATE INDEX IF NOT EXISTS idx_rep_practice_links_rep_id
ON rep_practice_links (rep_id);

-- 2. Product Joins - speeds up product data lookups in order_lines
CREATE INDEX IF NOT EXISTS idx_order_lines_product_id
ON order_lines (product_id)
WHERE product_id IS NOT NULL;

-- 3. Orders Status + Created At - speeds up status filtering
CREATE INDEX IF NOT EXISTS idx_orders_status_created
ON orders (status, created_at DESC)
WHERE status IS NOT NULL;