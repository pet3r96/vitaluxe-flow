-- Migration 3: Update calculate_order_line_profit to use effective prices
-- This ensures new orders use override prices (if set) for profit calculations

CREATE OR REPLACE FUNCTION public.calculate_order_line_profit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_price DECIMAL(10,2);
  v_topline_price DECIMAL(10,2);
  v_downline_price DECIMAL(10,2);
  v_practice_price DECIMAL(10,2);
  v_practice_price_before_discount DECIMAL(10,2);
  v_discount_percentage DECIMAL(5,2);
  v_topline_user_id UUID;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_admin_profit DECIMAL(10,2);
  v_topline_profit DECIMAL(10,2);
  v_downline_profit DECIMAL(10,2);
  v_admin_profit_before_discount DECIMAL(10,2);
  v_topline_profit_before_discount DECIMAL(10,2);
  v_downline_profit_before_discount DECIMAL(10,2);
  v_discount_code TEXT;
  v_effective_prices RECORD;
BEGIN
  -- Get product base price (never overridden)
  SELECT base_price 
  INTO v_base_price
  FROM products 
  WHERE id = NEW.product_id;
  
  -- Get EFFECTIVE prices (considering overrides) for this practice
  SELECT * INTO v_effective_prices
  FROM get_effective_product_price(
    NEW.product_id, 
    (SELECT doctor_id FROM orders WHERE id = NEW.order_id)
  );
  
  -- Use effective prices instead of defaults
  v_topline_price := v_effective_prices.effective_topline_price;
  v_downline_price := v_effective_prices.effective_downline_price;
  
  -- Get discount info from order_line
  v_discount_percentage := COALESCE(NEW.discount_percentage, 0);
  v_practice_price := NEW.price;
  v_practice_price_before_discount := COALESCE(NEW.price_before_discount, NEW.price);
  
  -- Get discount code from parent order
  SELECT discount_code INTO v_discount_code
  FROM orders WHERE id = NEW.order_id;
  
  -- Get practice's linked_topline_id
  SELECT linked_topline_id
  INTO v_topline_user_id
  FROM profiles
  WHERE id = (SELECT doctor_id FROM orders WHERE id = NEW.order_id);
  
  -- Identify reps
  IF v_topline_user_id IS NOT NULL THEN
    SELECT r.id, r.assigned_topline_id 
    INTO v_downline_rep_id, v_topline_rep_id
    FROM reps r
    WHERE r.user_id = v_topline_user_id 
      AND r.role = 'downline'
    LIMIT 1;
    
    IF v_downline_rep_id IS NULL THEN
      SELECT id INTO v_topline_rep_id
      FROM reps
      WHERE user_id = v_topline_user_id 
        AND role = 'topline'
      LIMIT 1;
    END IF;
  END IF;
  
  -- Calculate profits BEFORE discount (using effective prices)
  IF v_topline_rep_id IS NULL THEN
    v_admin_profit_before_discount := (v_practice_price_before_discount - v_base_price) * NEW.quantity;
    v_topline_profit_before_discount := 0;
    v_downline_profit_before_discount := 0;
    
  ELSIF v_downline_rep_id IS NULL THEN
    v_admin_profit_before_discount := (v_topline_price - v_base_price) * NEW.quantity;
    v_topline_profit_before_discount := (v_practice_price_before_discount - v_topline_price) * NEW.quantity;
    v_downline_profit_before_discount := 0;
    
  ELSE
    v_admin_profit_before_discount := (v_topline_price - v_base_price) * NEW.quantity;
    v_topline_profit_before_discount := (v_downline_price - v_topline_price) * NEW.quantity;
    v_downline_profit_before_discount := (v_practice_price_before_discount - v_downline_price) * NEW.quantity;
  END IF;
  
  -- Apply discount proportionally to ALL profits
  v_admin_profit := v_admin_profit_before_discount * (1 - v_discount_percentage / 100);
  v_topline_profit := v_topline_profit_before_discount * (1 - v_discount_percentage / 100);
  v_downline_profit := v_downline_profit_before_discount * (1 - v_discount_percentage / 100);
  
  -- Insert profit record with discount tracking
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
    quantity,
    discount_code,
    discount_percentage,
    admin_profit_before_discount,
    topline_profit_before_discount,
    downline_profit_before_discount
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
    NEW.quantity,
    v_discount_code,
    v_discount_percentage,
    v_admin_profit_before_discount,
    v_topline_profit_before_discount,
    v_downline_profit_before_discount
  );
  
  RETURN NEW;
END;
$$;