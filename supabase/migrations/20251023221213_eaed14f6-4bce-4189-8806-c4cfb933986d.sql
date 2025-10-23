-- Clean up orphaned test orders (orders created but never completed due to routing failures)
DELETE FROM orders 
WHERE status = 'cancelled'
  AND payment_status = 'pending'
  AND created_at > NOW() - INTERVAL '1 day'
  AND total_amount > 0;