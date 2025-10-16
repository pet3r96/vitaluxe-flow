-- Add authorization checks to security definer functions
-- This prevents unauthorized access to sensitive statistics and encryption data

CREATE OR REPLACE FUNCTION public.get_discount_code_stats(p_code text)
RETURNS TABLE(code text, total_uses bigint, total_discount_amount numeric, total_orders bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Only admins can view discount code statistics
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.get_encryption_coverage()
RETURNS TABLE(data_type text, total_records bigint, encrypted_records bigint, coverage_percentage numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Only admins can view encryption coverage metrics
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Patient PHI coverage (only count records with encryptable data)
  RETURN QUERY
  SELECT 
    'Patient PHI'::text,
    COUNT(*)::bigint as total_records,
    COUNT(*) FILTER (WHERE allergies_encrypted IS NOT NULL OR notes_encrypted IS NOT NULL)::bigint as encrypted_records,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE allergies_encrypted IS NOT NULL OR notes_encrypted IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 1)
    END as coverage_percentage
  FROM patients
  WHERE allergies IS NOT NULL OR notes IS NOT NULL;

  -- Prescription Data coverage (only count records with prescription data)
  RETURN QUERY
  SELECT 
    'Prescription Data'::text,
    COUNT(*)::bigint as total_records,
    COUNT(*) FILTER (WHERE prescription_url_encrypted IS NOT NULL OR custom_dosage_encrypted IS NOT NULL OR custom_sig_encrypted IS NOT NULL)::bigint as encrypted_records,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE prescription_url_encrypted IS NOT NULL OR custom_dosage_encrypted IS NOT NULL OR custom_sig_encrypted IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 1)
    END as coverage_percentage
  FROM order_lines
  WHERE prescription_url IS NOT NULL OR custom_dosage IS NOT NULL OR custom_sig IS NOT NULL;

  -- Payment Methods coverage
  RETURN QUERY
  SELECT 
    'Payment Methods'::text,
    COUNT(*)::bigint as total_records,
    COUNT(plaid_access_token_encrypted)::bigint as encrypted_records,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(plaid_access_token_encrypted)::numeric / COUNT(*)::numeric) * 100, 1)
    END as coverage_percentage
  FROM practice_payment_methods;
END;
$$;