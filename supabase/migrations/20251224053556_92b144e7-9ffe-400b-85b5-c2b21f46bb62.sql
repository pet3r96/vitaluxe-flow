-- Create bulk pricing function to eliminate N+1 query problem
-- This fetches effective prices for multiple products in a single call

CREATE OR REPLACE FUNCTION public.get_effective_prices_bulk(p_product_ids uuid[], p_user_id uuid)
RETURNS TABLE(
  product_id uuid,
  effective_topline_price numeric,
  effective_downline_price numeric,
  effective_retail_price numeric,
  base_price numeric,
  has_override boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_downline_rep_id uuid;
  v_topline_rep_id uuid;
BEGIN
  -- Get user's rep details once (fixed: use assigned_topline_id)
  SELECT r.id, r.assigned_topline_id INTO v_downline_rep_id, v_topline_rep_id 
  FROM reps r WHERE r.user_id = p_user_id;

  RETURN QUERY
  WITH product_data AS (
    SELECT 
      p.id as prod_id,
      p.base_price as prod_base_price,
      p.topline_price as prod_topline_price,
      p.downline_price as prod_downline_price,
      p.retail_price as prod_retail_price
    FROM products p
    WHERE p.id = ANY(p_product_ids)
  ),
  downline_overrides AS (
    SELECT 
      o.product_id,
      o.override_topline_price,
      o.override_downline_price,
      o.override_retail_price
    FROM rep_product_price_overrides o
    WHERE o.rep_id = v_downline_rep_id
      AND o.product_id = ANY(p_product_ids)
  ),
  topline_overrides AS (
    SELECT 
      o.product_id,
      o.override_topline_price,
      o.override_downline_price,
      o.override_retail_price
    FROM rep_product_price_overrides o
    WHERE o.rep_id = v_topline_rep_id
      AND o.product_id = ANY(p_product_ids)
  )
  SELECT 
    pd.prod_id as product_id,
    COALESCE(dl.override_topline_price, tl.override_topline_price, pd.prod_topline_price) as effective_topline_price,
    COALESCE(dl.override_downline_price, tl.override_downline_price, pd.prod_downline_price) as effective_downline_price,
    COALESCE(dl.override_retail_price, tl.override_retail_price, pd.prod_retail_price) as effective_retail_price,
    pd.prod_base_price as base_price,
    (dl.product_id IS NOT NULL OR tl.product_id IS NOT NULL) as has_override
  FROM product_data pd
  LEFT JOIN downline_overrides dl ON dl.product_id = pd.prod_id
  LEFT JOIN topline_overrides tl ON tl.product_id = pd.prod_id;
END;
$function$;