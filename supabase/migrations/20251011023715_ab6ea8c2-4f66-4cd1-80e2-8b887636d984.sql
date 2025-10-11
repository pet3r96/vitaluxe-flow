-- PHASE 11: Fix Commission & Profit Calculation Logic
-- Corrects rep identification and profit formulas

-- Drop and recreate the calculate_order_line_profit function with corrected logic
DROP FUNCTION IF EXISTS public.calculate_order_line_profit() CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_order_line_profit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Recreate the trigger
CREATE TRIGGER calculate_order_line_profit_trigger
  AFTER INSERT ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_line_profit();

-- Recalculate all existing profit records
-- Step 1: Delete all existing incorrect profits
DELETE FROM order_profits;

-- Step 2: Recalculate using corrected logic
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
  ol.id as order_line_id,
  -- Determine topline_id
  CASE
    WHEN p.linked_topline_id IS NULL THEN NULL
    -- If linked to downline, get their assigned topline
    WHEN EXISTS (
      SELECT 1 FROM reps r 
      WHERE r.user_id = p.linked_topline_id AND r.role = 'downline'
    ) THEN (
      SELECT r.assigned_topline_id FROM reps r 
      WHERE r.user_id = p.linked_topline_id AND r.role = 'downline' LIMIT 1
    )
    -- Otherwise, it's the topline directly
    ELSE (
      SELECT r.id FROM reps r 
      WHERE r.user_id = p.linked_topline_id AND r.role = 'topline' LIMIT 1
    )
  END as topline_id,
  -- Determine downline_id
  CASE
    WHEN EXISTS (
      SELECT 1 FROM reps r 
      WHERE r.user_id = p.linked_topline_id AND r.role = 'downline'
    ) THEN (
      SELECT r.id FROM reps r 
      WHERE r.user_id = p.linked_topline_id AND r.role = 'downline' LIMIT 1
    )
    ELSE NULL
  END as downline_id,
  -- Prices
  prod.base_price,
  prod.topline_price,
  prod.downline_price,
  ol.price as practice_price,
  -- Corrected Profit Calculations
  -- Topline Profit
  CASE
    WHEN p.linked_topline_id IS NULL THEN 0
    WHEN EXISTS (
      SELECT 1 FROM reps r 
      WHERE r.user_id = p.linked_topline_id AND r.role = 'downline'
    ) THEN (prod.downline_price - prod.topline_price) * ol.quantity
    ELSE (ol.price - prod.topline_price) * ol.quantity
  END as topline_profit,
  -- Downline Profit
  CASE
    WHEN EXISTS (
      SELECT 1 FROM reps r 
      WHERE r.user_id = p.linked_topline_id AND r.role = 'downline'
    ) THEN (ol.price - prod.downline_price) * ol.quantity
    ELSE 0
  END as downline_profit,
  -- Admin Profit
  CASE
    WHEN p.linked_topline_id IS NULL THEN (ol.price - prod.base_price) * ol.quantity
    ELSE (prod.topline_price - prod.base_price) * ol.quantity
  END as admin_profit,
  ol.quantity
FROM order_lines ol
JOIN orders o ON o.id = ol.order_id
JOIN profiles p ON o.doctor_id = p.id
JOIN products prod ON prod.id = ol.product_id
ORDER BY ol.created_at;