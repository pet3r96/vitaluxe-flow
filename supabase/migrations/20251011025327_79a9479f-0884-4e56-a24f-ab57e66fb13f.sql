-- Fix existing order_lines with incorrect pricing based on practice rep hierarchy
-- This migration corrects historical pricing to match the current 4-tier pricing model

-- Update order_lines.price based on practice's rep hierarchy
UPDATE order_lines ol
SET price = CASE
  -- When practice has a downline rep (linked_topline_id points to downline user)
  WHEN EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = o.doctor_id
    JOIN reps r ON r.user_id = p.linked_topline_id
    WHERE o.id = ol.order_id
      AND r.role = 'downline'
  ) THEN (
    SELECT COALESCE(prod.downline_price, prod.base_price)
    FROM products prod
    WHERE prod.id = ol.product_id
  )
  -- When practice has only a topline rep (linked_topline_id points to topline user)
  WHEN EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = o.doctor_id
    JOIN reps r ON r.user_id = p.linked_topline_id
    WHERE o.id = ol.order_id
      AND r.role = 'topline'
  ) THEN (
    SELECT COALESCE(prod.topline_price, prod.base_price)
    FROM products prod
    WHERE prod.id = ol.product_id
  )
  -- Independent practice - use retail_price (or base_price if retail not set)
  ELSE (
    SELECT COALESCE(prod.retail_price, prod.base_price)
    FROM products prod
    WHERE prod.id = ol.product_id
  )
END
WHERE ol.price != (
  -- Only update if price is actually different
  CASE
    WHEN EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.id = o.doctor_id
      JOIN reps r ON r.user_id = p.linked_topline_id
      WHERE o.id = ol.order_id AND r.role = 'downline'
    ) THEN (
      SELECT COALESCE(prod.downline_price, prod.base_price)
      FROM products prod WHERE prod.id = ol.product_id
    )
    WHEN EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.id = o.doctor_id
      JOIN reps r ON r.user_id = p.linked_topline_id
      WHERE o.id = ol.order_id AND r.role = 'topline'
    ) THEN (
      SELECT COALESCE(prod.topline_price, prod.base_price)
      FROM products prod WHERE prod.id = ol.product_id
    )
    ELSE (
      SELECT COALESCE(prod.retail_price, prod.base_price)
      FROM products prod WHERE prod.id = ol.product_id
    )
  END
);

-- Delete all order_profits to trigger recalculation with corrected prices
-- The calculate_order_line_profit trigger will automatically recreate them
DELETE FROM order_profits;

-- Re-trigger profit calculation for all existing order lines
-- This uses a temporary function to force the trigger to fire
DO $$
DECLARE
  order_line_record RECORD;
BEGIN
  FOR order_line_record IN 
    SELECT id, order_id, product_id, price, quantity 
    FROM order_lines
  LOOP
    -- Update updated_at to trigger the calculate_order_line_profit trigger
    UPDATE order_lines 
    SET updated_at = now()
    WHERE id = order_line_record.id;
  END LOOP;
END $$;