-- Fix incorrect order_profits calculations
-- Step 1: Delete all incorrectly calculated records
DELETE FROM order_profits;

-- Step 2: Backfill with CORRECT formulas matching calculate_order_line_profit() trigger
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
  
  -- ✅ CORRECTED: Admin profit calculation
  CASE 
    -- Rx products: admin gets all profit
    WHEN p.requires_prescription = true THEN (ol.price - p.base_price) * ol.quantity
    -- No reps: admin gets all profit
    WHEN COALESCE(r_top.id, r_down.assigned_topline_id) IS NULL THEN (ol.price - p.base_price) * ol.quantity
    -- Topline only: admin gets (topline_price - base_price)
    WHEN r_down.id IS NULL THEN (COALESCE(p.topline_price, p.base_price) - p.base_price) * ol.quantity
    -- Both reps: admin gets (topline_price - base_price) ✅ CORRECTED
    ELSE (COALESCE(p.topline_price, p.base_price) - p.base_price) * ol.quantity
  END as admin_profit,
  
  -- ✅ CORRECTED: Topline profit calculation
  CASE 
    -- Rx products: $0
    WHEN p.requires_prescription = true THEN 0
    -- No topline: $0
    WHEN COALESCE(r_top.id, r_down.assigned_topline_id) IS NULL THEN 0
    -- Topline only: gets (practice_price - topline_price)
    WHEN r_down.id IS NULL THEN (ol.price - COALESCE(p.topline_price, p.base_price)) * ol.quantity
    -- Both reps: gets (downline_price - topline_price) ✅ CORRECTED
    ELSE (COALESCE(p.downline_price, p.base_price) - COALESCE(p.topline_price, p.base_price)) * ol.quantity
  END as topline_profit,
  
  -- ✅ CORRECTED: Downline profit calculation
  CASE 
    -- Rx products or no downline: $0
    WHEN p.requires_prescription = true OR r_down.id IS NULL THEN 0
    -- Downline gets (practice_price - downline_price) ✅ CORRECTED
    ELSE (ol.price - COALESCE(p.downline_price, p.base_price)) * ol.quantity
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
LEFT JOIN reps r_top ON (r_top.user_id = prof.linked_topline_id AND r_top.role = 'topline')
                      OR (r_top.id = r_down.assigned_topline_id AND r_down.id IS NOT NULL);