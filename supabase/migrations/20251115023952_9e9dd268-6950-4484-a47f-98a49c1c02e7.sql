-- Performance optimization indexes for Orders page
-- These indexes will significantly improve query performance for pharmacy and general order queries

-- Index for pharmacy order_lines queries (assigned_pharmacy_id, created_at, order_id)
-- Speeds up pharmacy-specific order lookups with date filtering
CREATE INDEX IF NOT EXISTS idx_order_lines_assigned_created 
ON order_lines(assigned_pharmacy_id, created_at DESC, order_id)
WHERE assigned_pharmacy_id IS NOT NULL;

-- Index for orders by created_at and payment_status
-- Helps with general order filtering and sorting
CREATE INDEX IF NOT EXISTS idx_orders_created_payment 
ON orders(created_at DESC, payment_status)
WHERE status != 'cancelled';

-- Index for order_lines by created_at for time-based filtering
CREATE INDEX IF NOT EXISTS idx_order_lines_created 
ON order_lines(created_at DESC);

-- These indexes will speed up common order queries without blocking table operations