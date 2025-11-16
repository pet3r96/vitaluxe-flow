-- ========================================
-- PHASE 1: Add Missing Columns (Idempotent)
-- ========================================

-- A. Add columns to practice_rooms
ALTER TABLE practice_rooms 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true NOT NULL;

-- B. Add order_line_id to amazon_tracking_api_calls
ALTER TABLE amazon_tracking_api_calls 
  ADD COLUMN IF NOT EXISTS order_line_id UUID NULL;

-- Create index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'amazon_tracking_api_calls' 
    AND indexname = 'idx_amazon_tracking_api_calls_order_line_id'
  ) THEN
    CREATE INDEX idx_amazon_tracking_api_calls_order_line_id 
    ON amazon_tracking_api_calls(order_line_id);
  END IF;
END $$;