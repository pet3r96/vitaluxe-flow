
-- Fix security definer view by ensuring it respects RLS
-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS v_patients_with_portal_status;

CREATE VIEW v_patients_with_portal_status 
WITH (security_invoker=true)
AS
SELECT 
  p.id as patient_id,
  p.name,
  p.email,
  p.practice_id,
  pa.id as patient_account_id,
  pa.user_id,
  pa.status as portal_status,
  pa.last_login_at,
  CASE 
    WHEN pa.id IS NOT NULL THEN true 
    ELSE false 
  END as has_portal_access
FROM patients p
LEFT JOIN patient_accounts pa ON p.email = pa.email AND p.practice_id = pa.practice_id;

-- Grant access to authenticated users
GRANT SELECT ON v_patients_with_portal_status TO authenticated;
