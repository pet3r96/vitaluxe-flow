-- Drop existing function before recreating with updated signature
DROP FUNCTION IF EXISTS public.get_effective_product_price(uuid, uuid);

-- Create updated function that handles BOTH practice AND rep accounts
CREATE OR REPLACE FUNCTION public.get_effective_product_price(
  p_product_id uuid, 
  p_user_id uuid  -- Now works for practice OR rep user_id
)
RETURNS TABLE(
  effective_topline_price numeric, 
  effective_downline_price numeric, 
  effective_retail_price numeric, 
  has_override boolean, 
  override_source text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product RECORD;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_override_record RECORD;
  v_linked_topline_user_id UUID;
  v_is_practice BOOLEAN := false;
  v_is_rep BOOLEAN := false;
  v_rep_role app_role;
BEGIN
  -- Get product default prices
  SELECT base_price, topline_price, downline_price, retail_price
  INTO v_product
  FROM products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;
  
  -- STEP 1: Determine if p_user_id is a practice or a rep
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) INTO v_is_practice;
  SELECT role INTO v_rep_role FROM reps WHERE user_id = p_user_id LIMIT 1;
  v_is_rep := (v_rep_role IS NOT NULL);
  
  -- STEP 2A: If it's a PRACTICE account
  IF v_is_practice THEN
    -- Get practice's linked_topline_id
    SELECT linked_topline_id INTO v_linked_topline_user_id
    FROM profiles
    WHERE id = p_user_id;
    
    IF v_linked_topline_user_id IS NULL THEN
      -- No topline linkage, return defaults
      RETURN QUERY SELECT 
        v_product.topline_price,
        v_product.downline_price,
        v_product.retail_price,
        false::BOOLEAN,
        NULL::TEXT;
      RETURN;
    END IF;
    
    -- Resolve topline/downline rep IDs from practice linkage
    v_topline_rep_id := get_topline_rep_id_for_practice(v_linked_topline_user_id);
    
    SELECT r.id, r.assigned_topline_id
    INTO v_downline_rep_id, v_topline_rep_id
    FROM reps r
    WHERE r.user_id = v_linked_topline_user_id
      AND r.role = 'downline'
    LIMIT 1;
  END IF;
  
  -- STEP 2B: If it's a REP account (topline or downline)
  IF v_is_rep THEN
    IF v_rep_role = 'topline' THEN
      -- Direct lookup: this user is a topline rep
      SELECT id INTO v_topline_rep_id
      FROM reps
      WHERE user_id = p_user_id AND role = 'topline'
      LIMIT 1;
      
    ELSIF v_rep_role = 'downline' THEN
      -- Direct lookup: this user is a downline rep
      SELECT id, assigned_topline_id 
      INTO v_downline_rep_id, v_topline_rep_id
      FROM reps
      WHERE user_id = p_user_id AND role = 'downline'
      LIMIT 1;
    END IF;
  END IF;
  
  -- STEP 3: Check for overrides (priority: topline > downline > defaults)
  
  -- PRIORITY 1: Topline override
  IF v_topline_rep_id IS NOT NULL THEN
    SELECT *
    INTO v_override_record
    FROM rep_product_price_overrides
    WHERE rep_id = v_topline_rep_id
      AND product_id = p_product_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN QUERY SELECT
        COALESCE(v_override_record.override_topline_price, v_product.topline_price),
        COALESCE(v_override_record.override_downline_price, v_product.downline_price),
        COALESCE(v_override_record.override_retail_price, v_product.retail_price),
        true::BOOLEAN,
        'topline'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- PRIORITY 2: Downline override
  IF v_downline_rep_id IS NOT NULL THEN
    SELECT *
    INTO v_override_record
    FROM rep_product_price_overrides
    WHERE rep_id = v_downline_rep_id
      AND product_id = p_product_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN QUERY SELECT
        COALESCE(v_override_record.override_topline_price, v_product.topline_price),
        COALESCE(v_override_record.override_downline_price, v_product.downline_price),
        COALESCE(v_override_record.override_retail_price, v_product.retail_price),
        true::BOOLEAN,
        'downline'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- PRIORITY 3: No override, return defaults
  RETURN QUERY SELECT
    v_product.topline_price,
    v_product.downline_price,
    v_product.retail_price,
    false::BOOLEAN,
    NULL::TEXT;
END;
$function$;