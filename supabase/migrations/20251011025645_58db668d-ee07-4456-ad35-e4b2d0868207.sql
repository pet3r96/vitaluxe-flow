-- Recreate the calculate_order_line_profit function
CREATE OR REPLACE FUNCTION public.calculate_order_line_profit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_price DECIMAL(10,2);
  v_topline_price DECIMAL(10,2);
  v_downline_price DECIMAL(10,2);
  v_practice_price DECIMAL(10,2);
  v_topline_user_id UUID;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_admin_profit DECIMAL(10,2);
  v_topline_profit DECIMAL(10,2);
  v_downline_profit DECIMAL(10,2);
BEGIN
  -- Get product pricing tiers
  SELECT base_price, topline_price, downline_price 
  INTO v_base_price, v_topline_price, v_downline_price
  FROM products 
  WHERE id = NEW.product_id;
  
  -- Practice price is the order line price
  v_practice_price := NEW.price;
  
  -- Get practice's linked_topline_id (which may actually be a downline user_id)
  SELECT linked_topline_id
  INTO v_topline_user_id
  FROM profiles
  WHERE id = (SELECT doctor_id FROM orders WHERE id = NEW.order_id);
  
  -- CORRECTED REP IDENTIFICATION LOGIC
  -- Handle case where linked_topline_id points to a downline rep's user_id
  IF v_topline_user_id IS NOT NULL THEN
    -- First, check if linked_topline_id is actually a downline rep
    SELECT r.id, r.assigned_topline_id 
    INTO v_downline_rep_id, v_topline_rep_id
    FROM reps r
    WHERE r.user_id = v_topline_user_id 
      AND r.role = 'downline'
    LIMIT 1;
    
    -- If no downline found, check if it's a topline rep directly
    IF v_downline_rep_id IS NULL THEN
      SELECT id INTO v_topline_rep_id
      FROM reps
      WHERE user_id = v_topline_user_id 
        AND role = 'topline'
      LIMIT 1;
    END IF;
  END IF;
  
  -- CORRECTED PROFIT FORMULAS (4-tier pricing logic)
  
  -- Scenario A: No reps at all (practice operates independently)
  IF v_topline_rep_id IS NULL THEN
    v_admin_profit := (v_practice_price - v_base_price) * NEW.quantity;
    v_topline_profit := 0;
    v_downline_profit := 0;
    
  -- Scenario B: Topline rep only (no downline)
  ELSIF v_downline_rep_id IS NULL THEN
    -- Admin = Topline Price - Base Price
    v_admin_profit := (v_topline_price - v_base_price) * NEW.quantity;
    -- Topline = Practice Price - Topline Price
    v_topline_profit := (v_practice_price - v_topline_price) * NEW.quantity;
    v_downline_profit := 0;
    
  -- Scenario C: Topline + Downline (full hierarchy)
  ELSE
    -- Admin = Topline Price - Base Price
    v_admin_profit := (v_topline_price - v_base_price) * NEW.quantity;
    -- Topline = Downline Price - Topline Price
    v_topline_profit := (v_downline_price - v_topline_price) * NEW.quantity;
    -- Downline = Practice Price - Downline Price
    v_downline_profit := (v_practice_price - v_downline_price) * NEW.quantity;
  END IF;
  
  -- Insert corrected profit record
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
  ) VALUES (
    NEW.order_id,
    NEW.id,
    v_topline_rep_id,
    v_downline_rep_id,
    v_base_price,
    v_topline_price,
    v_downline_price,
    v_practice_price,
    v_topline_profit,
    v_downline_profit,
    v_admin_profit,
    NEW.quantity
  );
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger on order_lines
DROP TRIGGER IF EXISTS trg_calculate_order_line_profit ON order_lines;
CREATE TRIGGER trg_calculate_order_line_profit
  AFTER INSERT ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_line_profit();

-- Delete all existing order_profits
DELETE FROM order_profits;

-- Manually recalculate all order profits using direct INSERT
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
  ol.id AS order_line_id,
  CASE 
    WHEN dr.id IS NOT NULL THEN tr.id
    WHEN tr.id IS NOT NULL THEN tr.id
    ELSE NULL
  END AS topline_id,
  dr.id AS downline_id,
  p.base_price,
  p.topline_price,
  p.downline_price,
  ol.price AS practice_price,
  -- Calculate profits based on hierarchy
  CASE
    -- Scenario A: No reps (independent practice)
    WHEN dr.id IS NULL AND tr.id IS NULL THEN 0
    -- Scenario B: Topline only (no downline)
    WHEN dr.id IS NULL AND tr.id IS NOT NULL THEN (ol.price - p.topline_price) * ol.quantity
    -- Scenario C: Full hierarchy (topline + downline)
    ELSE (p.downline_price - p.topline_price) * ol.quantity
  END AS topline_profit,
  CASE
    -- Only downline gets profit in Scenario C
    WHEN dr.id IS NOT NULL THEN (ol.price - p.downline_price) * ol.quantity
    ELSE 0
  END AS downline_profit,
  CASE
    -- Scenario A: No reps
    WHEN dr.id IS NULL AND tr.id IS NULL THEN (ol.price - p.base_price) * ol.quantity
    -- Scenario B: Topline only
    WHEN dr.id IS NULL AND tr.id IS NOT NULL THEN (p.topline_price - p.base_price) * ol.quantity
    -- Scenario C: Full hierarchy
    ELSE (p.topline_price - p.base_price) * ol.quantity
  END AS admin_profit,
  ol.quantity
FROM order_lines ol
JOIN orders o ON o.id = ol.order_id
JOIN products p ON p.id = ol.product_id
JOIN profiles prof ON prof.id = o.doctor_id
LEFT JOIN reps dr ON dr.user_id = prof.linked_topline_id AND dr.role = 'downline'
LEFT JOIN reps tr ON (
  (dr.id IS NOT NULL AND tr.id = dr.assigned_topline_id) OR
  (dr.id IS NULL AND tr.user_id = prof.linked_topline_id AND tr.role = 'topline')
);