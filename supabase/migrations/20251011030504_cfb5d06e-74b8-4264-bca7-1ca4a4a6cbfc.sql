-- Fix downline profit: Update order_lines.price to retail_price for practices linked to downline reps
-- This ensures practices pay retail_price, creating proper profit margin for downline reps

UPDATE order_lines ol
SET price = prod.retail_price
FROM orders o, profiles p, reps r, products prod
WHERE ol.order_id = o.id
  AND o.doctor_id = p.id
  AND p.linked_topline_id = r.user_id
  AND ol.product_id = prod.id
  AND r.role = 'downline'
  AND ol.price != prod.retail_price;

-- Delete ONLY downline order_profits to trigger recalculation with corrected prices
DELETE FROM order_profits
WHERE downline_id IS NOT NULL;

-- Force trigger execution for all order_lines with downline reps
-- This will recreate order_profits with the corrected practice_price = retail_price
UPDATE order_lines ol
SET updated_at = now()
FROM orders o, profiles p, reps r
WHERE ol.order_id = o.id
  AND o.doctor_id = p.id
  AND p.linked_topline_id = r.user_id
  AND r.role = 'downline';