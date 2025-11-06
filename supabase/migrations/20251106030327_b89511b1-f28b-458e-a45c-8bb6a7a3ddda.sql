-- Performance Optimization: Add indexes for order_lines queries
-- These indexes will dramatically speed up pharmacy and provider order lookups

-- Index for pharmacy order queries (most critical)
CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_status 
  ON order_lines(assigned_pharmacy_id, status) 
  WHERE assigned_pharmacy_id IS NOT NULL;

-- Index for pharmacy order sorting
CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_created 
  ON order_lines(assigned_pharmacy_id, created_at DESC) 
  WHERE assigned_pharmacy_id IS NOT NULL;

-- Index for provider order queries
CREATE INDEX IF NOT EXISTS idx_order_lines_provider_created 
  ON order_lines(provider_id, created_at DESC) 
  WHERE provider_id IS NOT NULL;

-- Index for order_id lookups (joins)
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id 
  ON order_lines(order_id);

-- Composite index for common filtering patterns
CREATE INDEX IF NOT EXISTS idx_order_lines_status_created 
  ON order_lines(status, created_at DESC);