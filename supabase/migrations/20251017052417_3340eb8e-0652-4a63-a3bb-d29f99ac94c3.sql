-- Fix get_effective_product_price to correctly detect reps, providers, and practices
CREATE OR REPLACE FUNCTION public.get_effective_product_price(p_product_id uuid, p_user_id uuid)
RETURNS TABLE(effective_topline_price numeric, effective_downline_price numeric, effective_retail_price numeric, has_override boolean, override_source text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product RECORD;
  v_topline_rep_id UUID;
  v_downline_rep_id UUID;
  v_override_record RECORD;
  v_rep_role app_role;
  v_provider_practice_id UUID;
  v_practice_linked_topline UUID;
BEGIN
  -- Get product default prices
  SELECT base_price, topline_price, downline_price, retail_price
  INTO v_product
  FROM products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;
  
  -- STEP 1: Check if p_user_id is a REP (topline or downline)
  SELECT role INTO v_rep_role
  FROM reps
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_rep_role IS NOT NULL THEN
    -- User is a rep
    IF v_rep_role = 'topline' THEN
      SELECT id INTO v_topline_rep_id
      FROM reps
      WHERE user_id = p_user_id AND role = 'topline'
      LIMIT 1;
    ELSIF v_rep_role = 'downline' THEN
      SELECT id, assigned_topline_id
      INTO v_downline_rep_id, v_topline_rep_id
      FROM reps
      WHERE user_id = p_user_id AND role = 'downline'
      LIMIT 1;
    END IF;
  ELSE
    -- STEP 2: Check if p_user_id is a PROVIDER
    SELECT practice_id INTO v_provider_practice_id
    FROM providers
    WHERE user_id = p_user_id
    LIMIT 1;
    
    IF v_provider_practice_id IS NOT NULL THEN
      -- Provider: get practice's linked_topline_id
      SELECT linked_topline_id INTO v_practice_linked_topline
      FROM profiles
      WHERE id = v_provider_practice_id
      LIMIT 1;
      
      IF v_practice_linked_topline IS NOT NULL THEN
        v_topline_rep_id := get_topline_rep_id_for_practice(v_practice_linked_topline);
        
        -- Check if linked topline is actually a downline
        SELECT r.id, r.assigned_topline_id
        INTO v_downline_rep_id, v_topline_rep_id
        FROM reps r
        WHERE r.user_id = v_practice_linked_topline
          AND r.role = 'downline'
        LIMIT 1;
      END IF;
    ELSE
      -- STEP 3: Treat as PRACTICE/DOCTOR account
      SELECT linked_topline_id INTO v_practice_linked_topline
      FROM profiles
      WHERE id = p_user_id
      LIMIT 1;
      
      IF v_practice_linked_topline IS NOT NULL THEN
        v_topline_rep_id := get_topline_rep_id_for_practice(v_practice_linked_topline);
        
        -- Check if linked topline is actually a downline
        SELECT r.id, r.assigned_topline_id
        INTO v_downline_rep_id, v_topline_rep_id
        FROM reps r
        WHERE r.user_id = v_practice_linked_topline
          AND r.role = 'downline'
        LIMIT 1;
      END IF;
    END IF;
  END IF;
  
  -- STEP 4: Check for overrides (priority: topline > downline > defaults)
  
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
$$;

-- Add RLS policy to allow reading overrides for all relevant roles
CREATE POLICY "Pricing read for all relevant roles"
ON public.rep_product_price_overrides
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'topline'::app_role) OR
  has_role(auth.uid(), 'downline'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'provider'::app_role)
);