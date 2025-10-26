-- Update calculate_order_line_profit function to handle Rx products (zero rep profits)
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
  v_is_rx_required BOOLEAN;
BEGIN
  -- Get product pricing tiers AND Rx flag
  SELECT base_price, topline_price, downline_price, requires_prescription
  INTO v_base_price, v_topline_price, v_downline_price, v_is_rx_required
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
  
  -- ✅ NEW: Handle Rx products (federal anti-kickback compliance)
  IF v_is_rx_required = true THEN
    -- Rx orders: admin gets all profit, reps get $0
    v_admin_profit := (v_practice_price - v_base_price) * NEW.quantity;
    v_topline_profit := 0;
    v_downline_profit := 0;
  ELSE
    -- Non-Rx products: use existing 4-tier pricing logic
    
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
    quantity,
    is_rx_required
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
    v_is_rx_required
  );
  
  RETURN NEW;
END;
$function$;