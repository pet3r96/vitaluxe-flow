-- Recreate get_effective_product_price with correct return column names to match existing code
DROP FUNCTION IF EXISTS public.get_effective_product_price(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_effective_product_price(p_product_id uuid, p_user_id uuid)
RETURNS TABLE(effective_topline_price numeric, effective_downline_price numeric, effective_retail_price numeric, base_price numeric, has_override boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_downline_rep_id uuid;
  v_topline_rep_id uuid;
  v_product products%ROWTYPE;
  v_override_topline numeric;
  v_override_downline numeric;
  v_override_retail numeric;
  v_has_override boolean := false;
BEGIN
  -- Fetch the product
  SELECT * INTO v_product FROM products WHERE id = p_product_id;

  -- Determine the user's rep details (downline + topline rep)
  -- Fixed: use assigned_topline_id instead of upline_id
  SELECT r.id, r.assigned_topline_id INTO v_downline_rep_id, v_topline_rep_id FROM reps r WHERE r.user_id = p_user_id;

  -- Start with defaults
  v_override_topline := v_product.topline_price;
  v_override_downline := v_product.downline_price;
  v_override_retail := v_product.retail_price;

  -- 1. Check for downline override (if user is downline rep)
  IF v_downline_rep_id IS NOT NULL THEN
    SELECT
      COALESCE(override.override_topline_price, v_override_topline),
      COALESCE(override.override_downline_price, v_override_downline),
      COALESCE(override.override_retail_price, v_override_retail),
      true
    INTO v_override_topline, v_override_downline, v_override_retail, v_has_override
    FROM rep_product_price_overrides override
    WHERE override.rep_id = v_downline_rep_id AND override.product_id = p_product_id;
  END IF;

  -- 2. Check for topline override (topline price might cascade down)
  IF v_topline_rep_id IS NOT NULL THEN
    SELECT
      COALESCE(override.override_topline_price, v_override_topline),
      COALESCE(override.override_downline_price, v_override_downline),
      COALESCE(override.override_retail_price, v_override_retail),
      true
    INTO v_override_topline, v_override_downline, v_override_retail, v_has_override
    FROM rep_product_price_overrides override
    WHERE override.rep_id = v_topline_rep_id AND override.product_id = p_product_id;
  END IF;

  -- Return calculated prices
  RETURN QUERY SELECT v_override_topline, v_override_downline, v_override_retail, v_product.base_price, v_has_override;
END;
$$;