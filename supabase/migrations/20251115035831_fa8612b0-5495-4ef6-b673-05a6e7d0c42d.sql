-- Add index for faster practice/staff order queries
-- This index supports: WHERE doctor_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_doctor_created_desc 
ON orders (doctor_id, created_at DESC) 
WHERE status IS NOT NULL;

-- Add index for order_lines provider queries
CREATE INDEX IF NOT EXISTS idx_order_lines_provider_created 
ON order_lines (provider_id, created_at DESC) 
WHERE provider_id IS NOT NULL;

-- Add index for order_lines pharmacy queries  
CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_created
ON order_lines (assigned_pharmacy_id, created_at DESC)
WHERE assigned_pharmacy_id IS NOT NULL;

-- Set statement timeout for edge function queries (10 seconds)
-- This prevents long-running queries from blocking the database
ALTER DATABASE postgres SET statement_timeout = '10s';