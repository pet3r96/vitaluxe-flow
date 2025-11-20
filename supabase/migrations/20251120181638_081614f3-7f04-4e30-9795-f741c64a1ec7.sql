-- ========================================
-- Payment & Checkout Fix Migration
-- ========================================

-- 1. Clean up orphaned orders with payment_failed status
-- Only delete orders from today with no actual transaction ID (these were never processed)
DELETE FROM orders 
WHERE payment_status = 'payment_failed' 
  AND authorizenet_transaction_id IS NULL
  AND created_at >= CURRENT_DATE;

-- 2. Add helpful comment to payment_status column for documentation
COMMENT ON COLUMN orders.payment_status IS 'Payment status: pending (awaiting charge), paid (successful), payment_failed (declined/error). Orders should only be created AFTER successful payment authorization.';

-- 3. Log the cleanup for audit purposes
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deleted_count
  FROM orders 
  WHERE payment_status = 'payment_failed' 
    AND authorizenet_transaction_id IS NULL
    AND created_at >= CURRENT_DATE;
    
  RAISE NOTICE 'Cleaned up % orphaned payment_failed orders from today', deleted_count;
END $$;