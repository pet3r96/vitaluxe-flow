-- Backfill missing provider_id in order_lines
-- This ensures order_lines.provider_id is populated for all existing orders

-- Step 1: Update order_lines where provider_id is NULL
-- by finding the provider record for the order's doctor_id
UPDATE order_lines ol
SET provider_id = (
  SELECT p.id 
  FROM providers p
  WHERE p.user_id = (
    SELECT o.doctor_id 
    FROM orders o 
    WHERE o.id = ol.order_id
  )
  LIMIT 1
),
updated_at = now()
WHERE ol.provider_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM orders o 
    INNER JOIN providers p ON p.user_id = o.doctor_id
    WHERE o.id = ol.order_id
  );

-- Step 2: Add index for better query performance on provider_id
CREATE INDEX IF NOT EXISTS idx_order_lines_provider_id 
ON order_lines(provider_id) 
WHERE provider_id IS NOT NULL;

-- Step 3: Add comment explaining the relationship
COMMENT ON COLUMN order_lines.provider_id IS 'Foreign key to providers table. Should match the provider record where provider.user_id = orders.doctor_id. Backfilled and maintained by triggers.';

-- Step 4: Create audit log entry for the backfill
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM order_lines
  WHERE provider_id IS NOT NULL 
    AND updated_at > now() - interval '1 minute';
    
  INSERT INTO audit_logs (
    action_type,
    entity_type,
    details
  ) VALUES (
    'backfill_order_lines_provider_id',
    'order_lines',
    jsonb_build_object(
      'updated_count', updated_count,
      'timestamp', now(),
      'reason', 'Backfill missing provider_id to fix order count display for provider role'
    )
  );
END $$;