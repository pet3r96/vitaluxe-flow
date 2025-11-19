-- Create rep_product_visibility table for topline rep visibility controls
CREATE TABLE IF NOT EXISTS public.rep_product_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topline_rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(topline_rep_id, product_id)
);

-- Add indexes for performance
CREATE INDEX idx_rep_product_vis_topline ON rep_product_visibility(topline_rep_id);
CREATE INDEX idx_rep_product_vis_product ON rep_product_visibility(product_id);
CREATE INDEX idx_rep_product_vis_visible ON rep_product_visibility(visible) WHERE visible = false;

-- Enable RLS
ALTER TABLE rep_product_visibility ENABLE ROW LEVEL SECURITY;

-- Topline reps can manage their own visibility settings
CREATE POLICY "Topline reps manage own visibility"
ON rep_product_visibility
FOR ALL
TO authenticated
USING (
  topline_rep_id IN (
    SELECT id FROM reps WHERE user_id = auth.uid() AND role = 'topline'
  )
);

-- Admins can view/manage all visibility settings
CREATE POLICY "Admins manage all visibility"
ON rep_product_visibility
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage all
CREATE POLICY "rep_product_visibility_svc"
ON rep_product_visibility
FOR ALL
TO service_role
USING (true);

-- Trigger for updated_at
CREATE TRIGGER set_rep_product_visibility_updated_at
BEFORE UPDATE ON rep_product_visibility
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Fix get_effective_product_price function to use correct column name
CREATE OR REPLACE FUNCTION public.get_effective_product_price(
  p_product_id uuid, 
  p_user_id uuid
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
  v_rep_role app_role;
  v_provider_practice_id UUID;
  v_practice_linked_topline UUID;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  SELECT role INTO v_rep_role FROM profiles WHERE id = p_user_id;

  IF v_rep_role = 'topline' THEN
    SELECT r.id INTO v_topline_rep_id FROM reps r WHERE r.user_id = p_user_id;
  ELSIF v_rep_role = 'downline' THEN
    SELECT r.id, r.upline_id INTO v_downline_rep_id, v_topline_rep_id FROM reps r WHERE r.user_id = p_user_id;
  ELSIF v_rep_role = 'practice' THEN
    SELECT practice_id INTO v_provider_practice_id FROM profiles WHERE id = p_user_id;
    IF v_provider_practice_id IS NOT NULL THEN
      SELECT rep_id INTO v_topline_rep_id FROM practice_reps WHERE practice_id = v_provider_practice_id AND is_primary = true LIMIT 1;
    END IF;
  ELSIF v_rep_role = 'provider' THEN
    SELECT practice_id INTO v_provider_practice_id FROM providers WHERE id = p_user_id;
    IF v_provider_practice_id IS NOT NULL THEN
      SELECT rep_id INTO v_topline_rep_id FROM practice_reps WHERE practice_id = v_provider_practice_id AND is_primary = true LIMIT 1;
    END IF;
  END IF;

  -- PRIORITY 1: Topline override (FIXED: use rep_user_id instead of rep_id)
  IF v_topline_rep_id IS NOT NULL THEN
    SELECT *
    INTO v_override_record
    FROM rep_product_price_overrides
    WHERE rep_user_id = v_topline_rep_id
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
  
  -- PRIORITY 2: Downline override (FIXED: use rep_user_id instead of rep_id)
  IF v_downline_rep_id IS NOT NULL THEN
    SELECT *
    INTO v_override_record
    FROM rep_product_price_overrides
    WHERE rep_user_id = v_downline_rep_id
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