-- Create discount_codes table
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  description TEXT,
  active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_discount_codes_code ON discount_codes(code) WHERE active = true;
CREATE INDEX idx_discount_codes_active ON discount_codes(active, valid_from, valid_until);

-- RLS Policies
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount codes"
  ON discount_codes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated users can view active codes"
  ON discount_codes FOR SELECT
  USING (active = true AND (valid_until IS NULL OR valid_until > now()));

-- Add discount fields to orders table
ALTER TABLE orders
  ADD COLUMN discount_code TEXT,
  ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN subtotal_before_discount DECIMAL(10,2);

-- Update existing orders
UPDATE orders SET 
  discount_percentage = 0,
  discount_amount = 0,
  subtotal_before_discount = total_amount
WHERE discount_percentage IS NULL;

-- Add discount fields to order_lines table
ALTER TABLE order_lines
  ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN price_before_discount DECIMAL(10,2),
  ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;

-- Update existing order lines
UPDATE order_lines SET 
  discount_percentage = 0,
  price_before_discount = price,
  discount_amount = 0
WHERE discount_percentage IS NULL;

-- Add discount fields to order_profits table
ALTER TABLE order_profits
  ADD COLUMN discount_code TEXT,
  ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN admin_profit_before_discount DECIMAL(10,2),
  ADD COLUMN topline_profit_before_discount DECIMAL(10,2),
  ADD COLUMN downline_profit_before_discount DECIMAL(10,2);

-- Update calculate_order_line_profit function to handle discounts
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
BEGIN
  -- Get product pricing tiers
  SELECT base_price, topline_price, downline_price 
  INTO v_base_price, v_topline_price, v_downline_price
  FROM products 
  WHERE id = NEW.product_id;
  
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
  
  -- Calculate profits BEFORE discount
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
$function$;

-- Create discount code validation function
CREATE OR REPLACE FUNCTION validate_discount_code(p_code TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  discount_percentage DECIMAL(5,2),
  message TEXT
) AS $$
DECLARE
  v_code RECORD;
BEGIN
  SELECT * INTO v_code
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_uses IS NULL OR current_uses < max_uses)
  LIMIT 1;
  
  IF v_code IS NULL THEN
    RETURN QUERY SELECT false, 0::DECIMAL(5,2), 'Invalid or expired discount code';
  ELSE
    RETURN QUERY SELECT true, v_code.discount_percentage, 'Discount code applied successfully';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment discount code usage
CREATE OR REPLACE FUNCTION increment_discount_usage(p_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE discount_codes
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE UPPER(code) = UPPER(p_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get discount code stats
CREATE OR REPLACE FUNCTION get_discount_code_stats(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  total_uses BIGINT,
  total_discount_amount DECIMAL,
  total_orders BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.discount_code,
    COUNT(*) as total_uses,
    SUM(o.discount_amount) as total_discount_amount,
    COUNT(DISTINCT o.id) as total_orders
  FROM orders o
  WHERE UPPER(o.discount_code) = UPPER(p_code)
  GROUP BY o.discount_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;