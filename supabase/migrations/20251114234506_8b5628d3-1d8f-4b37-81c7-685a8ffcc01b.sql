-- Performance indexes for provider order lookups
-- Index on order_lines(provider_id, order_id) for efficient provider->orders lookup
CREATE INDEX IF NOT EXISTS idx_order_lines_provider_order 
ON order_lines(provider_id, order_id)
WHERE provider_id IS NOT NULL;

-- Index on orders(id, created_at) for efficient ordering after filtering
CREATE INDEX IF NOT EXISTS idx_orders_id_created 
ON orders(id, created_at DESC);