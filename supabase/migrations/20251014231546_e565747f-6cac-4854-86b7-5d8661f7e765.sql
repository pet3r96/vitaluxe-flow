-- Create function to calculate encryption coverage
CREATE OR REPLACE FUNCTION public.get_encryption_coverage()
RETURNS TABLE (
  data_type text,
  total_records bigint,
  encrypted_records bigint,
  coverage_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Create initial encryption key for status display
INSERT INTO public.encryption_keys (key_name, active, created_at)
VALUES ('primary_encryption_key_2025', true, now())
ON CONFLICT DO NOTHING;