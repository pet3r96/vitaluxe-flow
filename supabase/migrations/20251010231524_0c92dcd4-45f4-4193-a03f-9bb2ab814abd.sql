-- Create function to calculate order line profit
CREATE OR REPLACE FUNCTION calculate_order_line_profit()
RETURNS TRIGGER AS $$
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
  -- Get product pricing
  SELECT base_price, topline_price, downline_price 
  INTO v_base_price, v_topline_price, v_downline_price
  FROM products 
  WHERE id = NEW.product_id;
  
  -- Practice price is the order line price
  v_practice_price := NEW.price;
  
  -- Get practice's linked topline user_id
  SELECT linked_topline_id
  INTO v_topline_user_id
  FROM profiles
  WHERE id = (SELECT doctor_id FROM orders WHERE id = NEW.order_id);
  
  -- Get topline rep record if exists
  IF v_topline_user_id IS NOT NULL THEN
    SELECT id INTO v_topline_rep_id
    FROM reps
    WHERE user_id = v_topline_user_id 
      AND role = 'topline'
    LIMIT 1;
  END IF;
  
  -- Get downline rep if exists (find downline assigned to this topline for this practice)
  IF v_topline_rep_id IS NOT NULL THEN
    SELECT r.id INTO v_downline_rep_id
    FROM reps r
    WHERE r.assigned_topline_id = v_topline_rep_id 
      AND r.role = 'downline'
      AND EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = (SELECT doctor_id FROM orders WHERE id = NEW.order_id)
      )
    LIMIT 1;
  END IF;
  
  -- Calculate admin profit
  IF v_topline_rep_id IS NOT NULL THEN
    -- Admin profit = topline_price - base_price
    v_admin_profit := (v_topline_price - v_base_price) * NEW.quantity;
  ELSE
    -- No topline, admin profit = practice_price - base_price
    v_admin_profit := (v_practice_price - v_base_price) * NEW.quantity;
  END IF;
  
  -- Calculate topline profit
  IF v_topline_rep_id IS NOT NULL THEN
    IF v_downline_rep_id IS NOT NULL THEN
      -- Topline profit = downline_price - topline_price
      v_topline_profit := (v_downline_price - v_topline_price) * NEW.quantity;
    ELSE
      -- No downline, topline profit = practice_price - topline_price
      v_topline_profit := (v_practice_price - v_topline_price) * NEW.quantity;
    END IF;
  ELSE
    v_topline_profit := 0;
  END IF;
  
  -- Calculate downline profit
  IF v_downline_rep_id IS NOT NULL THEN
    -- Downline profit = practice_price - downline_price
    v_downline_profit := (v_practice_price - v_downline_price) * NEW.quantity;
  ELSE
    v_downline_profit := 0;
  END IF;
  
  -- Insert profit record
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on order_lines
CREATE TRIGGER calculate_profit_on_order_line
  AFTER INSERT ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_line_profit();

-- Backfill existing order_lines with profit calculations
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
  (SELECT r.id FROM reps r WHERE r.user_id = p.linked_topline_id AND r.role = 'topline' LIMIT 1) as topline_rep_id,
  (SELECT r.id FROM reps r WHERE r.assigned_topline_id = (SELECT r2.id FROM reps r2 WHERE r2.user_id = p.linked_topline_id AND r2.role = 'topline' LIMIT 1) AND r.role = 'downline' LIMIT 1) as downline_rep_id,
  prod.base_price,
  prod.topline_price,
  prod.downline_price,
  ol.price as practice_price,
  -- Topline profit calculation
  CASE 
    WHEN (SELECT r.id FROM reps r WHERE r.user_id = p.linked_topline_id AND r.role = 'topline' LIMIT 1) IS NOT NULL THEN
      CASE 
        WHEN (SELECT r.id FROM reps r WHERE r.assigned_topline_id = (SELECT r2.id FROM reps r2 WHERE r2.user_id = p.linked_topline_id AND r2.role = 'topline' LIMIT 1) AND r.role = 'downline' LIMIT 1) IS NOT NULL THEN
          (prod.downline_price - prod.topline_price) * ol.quantity
        ELSE
          (ol.price - prod.topline_price) * ol.quantity
      END
    ELSE 0
  END as topline_profit,
  -- Downline profit calculation
  CASE 
    WHEN (SELECT r.id FROM reps r WHERE r.assigned_topline_id = (SELECT r2.id FROM reps r2 WHERE r2.user_id = p.linked_topline_id AND r2.role = 'topline' LIMIT 1) AND r.role = 'downline' LIMIT 1) IS NOT NULL THEN
      (ol.price - prod.downline_price) * ol.quantity
    ELSE 0
  END as downline_profit,
  -- Admin profit calculation
  CASE 
    WHEN (SELECT r.id FROM reps r WHERE r.user_id = p.linked_topline_id AND r.role = 'topline' LIMIT 1) IS NOT NULL THEN
      (prod.topline_price - prod.base_price) * ol.quantity
    ELSE
      (ol.price - prod.base_price) * ol.quantity
  END as admin_profit,
  ol.quantity
FROM order_lines ol
JOIN orders o ON ol.order_id = o.id
JOIN profiles p ON o.doctor_id = p.id
JOIN products prod ON ol.product_id = prod.id
WHERE NOT EXISTS (
  SELECT 1 FROM order_profits WHERE order_line_id = ol.id
);