-- Phase 2: Optimize cart performance with compound index on cart_id + product_id
CREATE INDEX IF NOT EXISTS idx_cart_lines_cart_product 
ON cart_lines (cart_id, product_id);

COMMENT ON INDEX idx_cart_lines_cart_product IS 'Optimizes add-to-cart upsert operations and duplicate detection by indexing cart_id + product_id';