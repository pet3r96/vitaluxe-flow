-- Performance optimization indexes for pharmacy and calendar queries
-- These indexes will dramatically speed up the most common queries

-- Index for pharmacy order_lines queries (used in PharmacyShippingManager)
-- This helps when fetching orders by pharmacy and sorting by created_at
CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_created 
ON order_lines(assigned_pharmacy_id, created_at DESC)
WHERE assigned_pharmacy_id IS NOT NULL;

-- Index for calendar appointment queries by practice and date range
CREATE INDEX IF NOT EXISTS idx_appointments_practice_date 
ON patient_appointments(practice_id, start_time)
WHERE practice_id IS NOT NULL;

-- Index for calendar appointment queries by provider and date
CREATE INDEX IF NOT EXISTS idx_appointments_provider_date 
ON patient_appointments(provider_id, start_time)
WHERE provider_id IS NOT NULL;

-- Index for faster order status filtering
CREATE INDEX IF NOT EXISTS idx_order_lines_status 
ON order_lines(status, created_at DESC);

-- Composite index for pharmacy orders with status filtering
CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_status 
ON order_lines(assigned_pharmacy_id, status, created_at DESC)
WHERE assigned_pharmacy_id IS NOT NULL;