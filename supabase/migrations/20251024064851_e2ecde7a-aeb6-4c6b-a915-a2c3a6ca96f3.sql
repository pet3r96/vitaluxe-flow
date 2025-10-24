-- Fix downline profit calculation by correcting practice topline link and recalculating profits

-- Step 1: Update practice's linked_topline_id to correct topline user
UPDATE profiles
SET 
  linked_topline_id = '24a9d805-2678-43f0-b207-9fdb7d0fc7af',
  updated_at = now()
WHERE id = '64b936b4-135f-425f-8b1d-8e54dc7cf63c';

-- Step 2: Recalculate order_profits for this practice's orders
-- Set correct downline_id and recalculate downline profits
UPDATE order_profits op
SET 
  downline_id = 'd6d28d46-6f0b-4845-b4e0-987ab1a43892',
  downline_profit = (op.practice_price - op.downline_price) * op.quantity * (1 - COALESCE(op.discount_percentage, 0) / 100),
  downline_profit_before_discount = (op.practice_price - op.downline_price) * op.quantity
WHERE op.order_id IN (
  SELECT id FROM orders 
  WHERE doctor_id = '64b936b4-135f-425f-8b1d-8e54dc7cf63c'
)
AND op.downline_id IS NULL;