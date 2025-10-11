-- Hotfix: Restore missing order_profits for downline-linked practices
-- Step 1: Update order_lines.price to retail_price for practices linked to downline reps
UPDATE order_lines ol
SET price = prod.retail_price
FROM orders o, profiles p, reps r, products prod
WHERE ol.order_id = o.id
  AND o.doctor_id = p.id
  AND p.linked_topline_id = r.user_id
  AND r.role = 'downline'
  AND ol.product_id = prod.id
  AND ol.price IS DISTINCT FROM prod.retail_price;

-- Step 2: Backfill missing order_profits rows for downline order_lines
-- Using Phase 11 four-tier formulas:
-- Admin: topline_price - base_price
-- Topline: downline_price - topline_price  
-- Downline: practice_price - downline_price
INSERT INTO order_profits (
  order_id,
  order_line_id,
  topline_id,
  downline_id,
  base_price,
  topline_price,
  downline_price,
  practice_price,
  topline_profit,
  downline_profit,
  admin_profit,
  quantity
)
SELECT
  ol.order_id,
  ol.id,
  r.assigned_topline_id AS topline_id,
  r.id AS downline_id,
  prod.base_price,
  prod.topline_price,
  prod.downline_price,
  ol.price AS practice_price,
  (prod.downline_price - prod.topline_price) * ol.quantity AS topline_profit,
  (ol.price - prod.downline_price) * ol.quantity AS downline_profit,
  (prod.topline_price - prod.base_price) * ol.quantity AS admin_profit,
  ol.quantity
FROM order_lines ol, orders o, profiles p, reps r, products prod
WHERE ol.order_id = o.id
  AND o.doctor_id = p.id
  AND p.linked_topline_id = r.user_id
  AND r.role = 'downline'
  AND ol.product_id = prod.id
  AND NOT EXISTS (
    SELECT 1 FROM order_profits op WHERE op.order_line_id = ol.id
  );