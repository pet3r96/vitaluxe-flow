-- Fix v_patients_with_portal_status to use actual login data from auth.users
-- The issue: view was using patient_accounts.last_login_at (always NULL)
-- The fix: join with auth.users and use last_sign_in_at (actual login data)

DROP VIEW IF EXISTS v_patients_with_portal_status;

CREATE VIEW v_patients_with_portal_status AS
SELECT 
  pa.id,
  pa.id as patient_id,
  pa.id as patient_account_id,
  pa.first_name,
  pa.last_name,
  pa.name,
  pa.email,
  pa.phone,
  pa.practice_id,
  pa.provider_id,
  pa.date_of_birth,
  pa.address_street,
  pa.address_city,
  pa.address_state,
  pa.address_zip,
  pa.address_verification_status,
  pa.address_verification_source,
  pa.created_at,
  pa.updated_at,
  pa.user_id,
  (pa.user_id IS NOT NULL) as has_portal_account,
  (pa.user_id IS NOT NULL AND pa.status != 'disabled') as has_portal_access,
  au.last_sign_in_at as last_login_at,
  CASE
    WHEN pa.status = 'disabled' THEN 'disabled'
    WHEN pa.user_id IS NULL THEN 'no_portal'
    WHEN au.last_sign_in_at IS NULL THEN 'invited'
    ELSE 'active'
  END as portal_status
FROM patient_accounts pa
LEFT JOIN auth.users au ON pa.user_id = au.id;