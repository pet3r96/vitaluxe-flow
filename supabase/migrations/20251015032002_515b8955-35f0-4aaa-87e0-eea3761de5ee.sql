-- Drop the existing view
DROP VIEW IF EXISTS public.cart_lines_masked;

-- Recreate with security_invoker to respect RLS policies
CREATE VIEW public.cart_lines_masked
WITH (security_invoker = true)
AS
SELECT 
  id,
  cart_id,
  product_id,
  provider_id,
  patient_id,
  patient_name,
  CASE 
    WHEN patient_email IS NOT NULL 
    THEN LEFT(patient_email, 3) || '***@' || SPLIT_PART(patient_email, '@', 2)
    ELSE NULL 
  END as patient_email_masked,
  CASE 
    WHEN patient_phone IS NOT NULL 
    THEN '***-***-' || RIGHT(patient_phone, 4)
    ELSE NULL 
  END as patient_phone_masked,
  CASE 
    WHEN patient_address IS NOT NULL 
    THEN LEFT(patient_address, 10) || '...'
    ELSE NULL 
  END as patient_address_masked,
  CASE 
    WHEN prescription_url IS NOT NULL 
    THEN '[PRESCRIPTION ON FILE]'
    ELSE NULL 
  END as prescription_url_indicator,
  prescription_method,
  order_notes,
  destination_state,
  quantity,
  price_snapshot,
  refills_allowed,
  refills_total,
  refills_remaining,
  created_at,
  expires_at
FROM public.cart_lines;

-- Grant access to authenticated users (RLS will filter based on underlying table policies)
GRANT SELECT ON public.cart_lines_masked TO authenticated;