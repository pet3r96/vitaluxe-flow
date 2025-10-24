-- Fix practice linked_topline_id to point to topline instead of downline
UPDATE profiles
SET linked_topline_id = '24a9d805-2678-43f0-b207-9fdb7d0fc7af'
WHERE id = '64b936b4-135f-425f-8b1d-8e54dc7cf63c'
AND linked_topline_id = 'd29f4998-2bec-402a-b980-a1b3be412cef';

-- Fix order_profits: populate downline_id and recalculate downline_profit
UPDATE order_profits
SET 
  downline_id = 'd6d28d46-6f0b-4845-b4e0-987ab1a43892',
  downline_profit = (practice_price - downline_price) * quantity * (1 - discount_percentage / 100),
  downline_profit_before_discount = (practice_price - downline_price) * quantity
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE doctor_id = '64b936b4-135f-425f-8b1d-8e54dc7cf63c'
)
AND downline_id IS NULL;