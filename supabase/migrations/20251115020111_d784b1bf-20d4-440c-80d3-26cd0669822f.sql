-- Phase 1: Critical Performance Indexes
-- These indexes resolve 6-9 second query timeouts on orders page

-- Index 1: Orders table composite index for date + status filtering
CREATE INDEX IF NOT EXISTS idx_orders_created_status 
ON orders(created_at DESC, status);

-- Index 2: Order lines composite index for date + order joins
CREATE INDEX IF NOT EXISTS idx_order_lines_created_order 
ON order_lines(created_at DESC, order_id);

-- Index 3: Order lines provider lookup (for provider role queries)
CREATE INDEX IF NOT EXISTS idx_order_lines_provider 
ON order_lines(provider_id) 
WHERE provider_id IS NOT NULL;