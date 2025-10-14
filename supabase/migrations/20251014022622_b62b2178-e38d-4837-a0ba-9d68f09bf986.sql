-- Phase 1: Critical Security Fixes

-- Fix 1.1: Add SET search_path = public to discount code functions
CREATE OR REPLACE FUNCTION public.validate_discount_code(p_code text)
RETURNS TABLE(valid boolean, discount_percentage numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.increment_discount_usage(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE discount_codes
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE UPPER(code) = UPPER(p_code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_discount_code_stats(p_code text)
RETURNS TABLE(code text, total_uses bigint, total_discount_amount numeric, total_orders bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix 1.2: Restrict discount codes RLS to admins only
DROP POLICY IF EXISTS "All authenticated users can view active codes" ON discount_codes;

CREATE POLICY "Admins can view all discount codes"
ON discount_codes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2.3: Restrict product-pharmacy access to admins and pharmacies
DROP POLICY IF EXISTS "Authenticated users can view product pharmacies" ON product_pharmacies;

CREATE POLICY "Admins and pharmacies can view product pharmacies"
ON product_pharmacies
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'pharmacy'::app_role)
);