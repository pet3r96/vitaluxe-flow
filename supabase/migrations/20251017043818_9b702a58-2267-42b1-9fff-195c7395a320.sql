-- Reverse cascade priority: topline overrides take precedence over downline
CREATE OR REPLACE FUNCTION public.get_effective_product_price(p_product_id uuid, p_practice_user_id uuid)
 RETURNS TABLE(effective_topline_price numeric, effective_downline_price numeric, effective_retail_price numeric, has_override boolean, override_source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_topline_user_id UUID;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_override_record RECORD;
  v_product RECORD;
BEGIN
  -- Get product default prices
  SELECT base_price, topline_price, downline_price, retail_price
  INTO v_product
  FROM products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;
  
  -- Get practice's linked_topline_id
  SELECT linked_topline_id
  INTO v_topline_user_id
  FROM profiles
  WHERE id = p_practice_user_id;
  
  IF v_topline_user_id IS NULL THEN
    -- No topline linkage, return defaults
    RETURN QUERY SELECT 
      v_product.topline_price,
      v_product.downline_price,
      v_product.retail_price,
      false::BOOLEAN,
      NULL::TEXT;
    RETURN;
  END IF;
  
  -- Resolve topline/downline rep IDs
  v_topline_rep_id := get_topline_rep_id_for_practice(v_topline_user_id);
  
  -- Check if linked_topline_id is actually a downline rep
  SELECT r.id, r.assigned_topline_id
  INTO v_downline_rep_id, v_topline_rep_id
  FROM reps r
  WHERE r.user_id = v_topline_user_id
    AND r.role = 'downline'
  LIMIT 1;
  
  -- PRIORITY 1: Check for topline-specific override (company-wide takes precedence)
  IF v_topline_rep_id IS NOT NULL THEN
    SELECT *
    INTO v_override_record
    FROM rep_product_price_overrides
    WHERE rep_id = v_topline_rep_id
      AND product_id = p_product_id
    LIMIT 1;
    
    IF FOUND THEN
      -- Return topline's override (merged with defaults for NULLs)
      RETURN QUERY SELECT
        COALESCE(v_override_record.override_topline_price, v_product.topline_price),
        COALESCE(v_override_record.override_downline_price, v_product.downline_price),
        COALESCE(v_override_record.override_retail_price, v_product.retail_price),
        true::BOOLEAN,
        'topline'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- PRIORITY 2: Check for downline-specific override (only if topline has no override)
  IF v_downline_rep_id IS NOT NULL THEN
    SELECT *
    INTO v_override_record
    FROM rep_product_price_overrides
    WHERE rep_id = v_downline_rep_id
      AND product_id = p_product_id
    LIMIT 1;
    
    IF FOUND THEN
      -- Return downline's override (merged with defaults for NULLs)
      RETURN QUERY SELECT
        COALESCE(v_override_record.override_topline_price, v_product.topline_price),
        COALESCE(v_override_record.override_downline_price, v_product.downline_price),
        COALESCE(v_override_record.override_retail_price, v_product.retail_price),
        true::BOOLEAN,
        'downline'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- PRIORITY 3: No override found, return defaults
  RETURN QUERY SELECT
    v_product.topline_price,
    v_product.downline_price,
    v_product.retail_price,
    false::BOOLEAN,
    NULL::TEXT;
END;
$function$;