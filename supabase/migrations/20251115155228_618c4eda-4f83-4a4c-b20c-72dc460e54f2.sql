-- Enable pg_trgm extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add indexes to improve get-orders-page performance
-- These indexes will significantly speed up the query execution

-- Index on orders.doctor_id for role-based filtering (most common filter)
CREATE INDEX IF NOT EXISTS idx_orders_doctor_id_created_at 
ON orders(doctor_id, created_at DESC) 
WHERE status IS NOT NULL;

-- Index on orders.created_at for date range filtering
CREATE INDEX IF NOT EXISTS idx_orders_created_at_status 
ON orders(created_at DESC, status) 
WHERE status IS NOT NULL;

-- Index on order_lines.order_id for joins
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id 
ON order_lines(order_id);

-- Index on order_lines for search by patient name
CREATE INDEX IF NOT EXISTS idx_order_lines_patient_name_trgm 
ON order_lines USING gin(patient_name gin_trgm_ops)
WHERE patient_name IS NOT NULL;

-- Index on order_lines for date-based queries
CREATE INDEX IF NOT EXISTS idx_order_lines_created_at 
ON order_lines(created_at DESC);

-- Composite index for provider lookups
CREATE INDEX IF NOT EXISTS idx_providers_user_id_active 
ON providers(user_id, active) 
WHERE active = true;