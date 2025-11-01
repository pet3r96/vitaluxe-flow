-- Drop and recreate v_patients_with_portal_status view with name field
DROP VIEW IF EXISTS v_patients_with_portal_status CASCADE;

CREATE VIEW v_patients_with_portal_status AS
SELECT 
  pa.id,
  pa.id as patient_id,  -- Alias for backward compatibility
  pa.id as patient_account_id,  -- Also include this for backward compatibility
  pa.first_name,
  pa.last_name,
  -- Computed name field
  COALESCE(
    NULLIF(TRIM(pa.first_name || ' ' || pa.last_name), ''),
    pa.email
  ) as name,
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
  -- Portal access fields
  CASE 
    WHEN pa.user_id IS NOT NULL THEN true
    ELSE false
  END as has_portal_account,
  CASE 
    WHEN pa.user_id IS NOT NULL THEN true
    ELSE false
  END as has_portal_access,  -- Alias for backward compatibility
  CASE
    WHEN pa.user_id IS NULL THEN NULL
    WHEN pa.last_login_at IS NOT NULL THEN 'active'::text
    ELSE 'invited'::text
  END as portal_status,
  pa.last_login_at,
  pa.user_id
FROM patient_accounts pa;