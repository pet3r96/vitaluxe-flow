-- Drop and recreate the recalculate function
DROP FUNCTION IF EXISTS recalculate_order_profits_for_practice(UUID);

CREATE FUNCTION recalculate_order_profits_for_practice(practice_user_id UUID)
RETURNS TABLE (
  result_order_line_id UUID,
  result_topline_rep_id UUID,
  result_downline_rep_id UUID,
  result_topline_profit DECIMAL,
  result_downline_profit DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_line RECORD;
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
  SELECT linked_topline_id INTO v_topline_user_id FROM profiles WHERE id = practice_user_id;
  
  IF v_topline_user_id IS NOT NULL THEN
    SELECT r.id, r.assigned_topline_id INTO v_downline_rep_id, v_topline_rep_id
    FROM reps r WHERE r.user_id = v_topline_user_id AND r.role = 'downline' LIMIT 1;
    
    IF v_downline_rep_id IS NULL THEN
      SELECT id INTO v_topline_rep_id FROM reps WHERE user_id = v_topline_user_id AND role = 'topline' LIMIT 1;
    END IF;
  END IF;
  
  FOR order_line IN SELECT ol.* FROM order_lines ol JOIN orders o ON ol.order_id = o.id WHERE o.doctor_id = practice_user_id
  LOOP
    SELECT base_price, topline_price, downline_price, requires_prescription
    INTO v_base_price, v_topline_price, v_downline_price, v_is_rx_required FROM products WHERE id = order_line.product_id;
    
    v_practice_price := order_line.price;
    
    IF v_is_rx_required = true THEN
      v_admin_profit := (v_practice_price - v_base_price) * order_line.quantity;
      v_topline_profit := 0; v_downline_profit := 0;
    ELSE
      IF v_topline_rep_id IS NULL THEN
        v_admin_profit := (v_practice_price - v_base_price) * order_line.quantity;
        v_topline_profit := 0; v_downline_profit := 0;
      ELSIF v_downline_rep_id IS NULL THEN
        v_admin_profit := (v_topline_price - v_base_price) * order_line.quantity;
        v_topline_profit := (v_practice_price - v_topline_price) * order_line.quantity;
        v_downline_profit := 0;
      ELSE
        v_admin_profit := (v_topline_price - v_base_price) * order_line.quantity;
        v_topline_profit := (v_downline_price - v_topline_price) * order_line.quantity;
        v_downline_profit := (v_practice_price - v_downline_price) * order_line.quantity;
      END IF;
    END IF;
    
    DELETE FROM order_profits op WHERE op.order_line_id = order_line.id;
    
    INSERT INTO order_profits (order_id, order_line_id, topline_id, downline_id, base_price, topline_price, downline_price, practice_price, topline_profit, downline_profit, admin_profit, quantity, is_rx_required)
    VALUES (order_line.order_id, order_line.id, v_topline_rep_id, v_downline_rep_id, v_base_price, v_topline_price, v_downline_price, v_practice_price, v_topline_profit, v_downline_profit, v_admin_profit, order_line.quantity, v_is_rx_required);
    
    result_order_line_id := order_line.id;
    result_topline_rep_id := v_topline_rep_id;
    result_downline_rep_id := v_downline_rep_id;
    result_topline_profit := v_topline_profit;
    result_downline_profit := v_downline_profit;
    RETURN NEXT;
  END LOOP;
END;
$$;