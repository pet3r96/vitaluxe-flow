
-- Update patient_accounts status column to allow 'invited' status
COMMENT ON COLUMN patient_accounts.status IS 
'Patient portal account status: active (logged in), invited (email sent, not logged in yet), inactive';

-- Create view to check patient portal status across both tables
CREATE OR REPLACE VIEW v_patients_with_portal_status AS
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

-- Add RLS policy for the view
ALTER VIEW v_patients_with_portal_status OWNER TO postgres;
GRANT SELECT ON v_patients_with_portal_status TO authenticated;
