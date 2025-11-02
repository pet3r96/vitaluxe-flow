-- Simplified backfill for order_profits
-- This uses a straightforward approach without complex LATERAL joins

INSERT INTO order_profits (
  order_id,
  order_line_id,
  quantity,
  practice_price,
  base_price,
  topline_price,
  downline_price,
  admin_profit,
  topline_profit,
  downline_profit,
  topline_id,
  downline_id,
  is_rx_required
)
SELECT 
  ol.order_id,
  ol.id as order_line_id,
  ol.quantity,
  ol.price as practice_price,
  p.base_price,
  COALESCE(p.topline_price, p.base_price) as topline_price,
  COALESCE(p.downline_price, p.base_price) as downline_price,
  -- Calculate admin_profit
  CASE 
    -- Rx products: admin gets all profit
    WHEN p.requires_prescription = true THEN (ol.price - p.base_price) * ol.quantity
    -- No reps: admin gets all profit
    WHEN COALESCE(r_top.id, r_down.assigned_topline_id) IS NULL THEN (ol.price - p.base_price) * ol.quantity
    -- Topline only: admin gets (topline_price - base_price)
    WHEN r_down.id IS NULL THEN (COALESCE(p.topline_price, p.base_price) - p.base_price) * ol.quantity
    -- Both reps: admin gets (downline_price - base_price)
    ELSE (COALESCE(p.downline_price, p.base_price) - p.base_price) * ol.quantity
  END as admin_profit,
  -- Calculate topline_profit
  CASE 
    -- Rx products: $0
    WHEN p.requires_prescription = true THEN 0
    -- No topline: $0
    WHEN COALESCE(r_top.id, r_down.assigned_topline_id) IS NULL THEN 0
    -- Topline only: gets (practice_price - topline_price)
    WHEN r_down.id IS NULL THEN (ol.price - COALESCE(p.topline_price, p.base_price)) * ol.quantity
    -- Both reps: gets (practice_price - topline_price)
    ELSE (ol.price - COALESCE(p.topline_price, p.base_price)) * ol.quantity
  END as topline_profit,
  -- Calculate downline_profit
  CASE 
    -- Rx products or no downline: $0
    WHEN p.requires_prescription = true OR r_down.id IS NULL THEN 0
    -- Downline gets (topline_price - downline_price)
    ELSE (COALESCE(p.topline_price, p.base_price) - COALESCE(p.downline_price, p.base_price)) * ol.quantity
  END as downline_profit,
  -- Topline ID
  COALESCE(r_top.id, r_down.assigned_topline_id) as topline_id,
  -- Downline ID
  r_down.id as downline_id,
  -- Rx flag
  p.requires_prescription as is_rx_required
FROM order_lines ol
JOIN orders o ON ol.order_id = o.id
JOIN products p ON ol.product_id = p.id
JOIN profiles prof ON o.doctor_id = prof.id
LEFT JOIN reps r_down ON r_down.user_id = prof.linked_topline_id AND r_down.role = 'downline'
LEFT JOIN reps r_top ON r_top.user_id = prof.linked_topline_id AND r_top.role = 'topline'
WHERE NOT EXISTS (
  SELECT 1 FROM order_profits op WHERE op.order_line_id = ol.id
);