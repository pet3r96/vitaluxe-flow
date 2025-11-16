
-- ============================================================================
-- STEP 3: ADD COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add metadata to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add practice_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS practice_id uuid REFERENCES profiles(id);

-- Populate orders.practice_id from doctor_id
UPDATE orders o
SET practice_id = p.id
FROM profiles p
WHERE o.doctor_id = p.id
  AND o.practice_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_practice ON orders(practice_id);
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING gin(metadata);
