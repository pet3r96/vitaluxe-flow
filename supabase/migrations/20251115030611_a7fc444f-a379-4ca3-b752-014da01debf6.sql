-- ============================================================================
-- FIX REMAINING 2 ERROR-LEVEL ISSUES
-- Add security_invoker=true to the last 2 views
-- ============================================================================

-- FIX 1: v_patients_with_portal_status
DROP VIEW IF EXISTS public.v_patients_with_portal_status CASCADE;
CREATE VIEW public.v_patients_with_portal_status
WITH (security_invoker=true) AS
SELECT 
  id,
  id AS patient_id,
  id AS patient_account_id,
  first_name,
  last_name,
  COALESCE(NULLIF(TRIM(BOTH FROM ((first_name || ' '::text) || last_name)), ''::text), email) AS name,
  email,
  phone,
  practice_id,
  provider_id,
  date_of_birth,
  address_street,
  address_city,
  address_state,
  address_zip,
  address_verification_status,
  address_verification_source,
  created_at,
  updated_at,
  CASE
    WHEN (user_id IS NOT NULL) THEN true
    ELSE false
  END AS has_portal_account,
  CASE
    WHEN (user_id IS NOT NULL) THEN true
    ELSE false
  END AS has_portal_access,
  CASE
    WHEN (user_id IS NULL) THEN NULL::text
    WHEN (last_login_at IS NOT NULL) THEN 'active'::text
    ELSE 'invited'::text
  END AS portal_status,
  last_login_at,
  user_id
FROM patient_accounts pa;

-- FIX 2: patient_account_health (ensure it's properly set)
DROP VIEW IF EXISTS public.patient_account_health CASCADE;
CREATE VIEW public.patient_account_health
WITH (security_invoker=true) AS
SELECT 
  pa.id AS patient_id,
  pa.first_name || ' ' || pa.last_name AS name,
  pa.email,
  pa.practice_id,
  p.name AS practice_name,
  pa.invitation_sent_at,
  pa.status AS account_status,
  CASE
    WHEN pa.user_id IS NOT NULL THEN 'linked'
    ELSE 'not_invited'
  END AS link_status,
  pa.created_at,
  pa.updated_at
FROM patient_accounts pa
LEFT JOIN profiles p ON p.id = pa.practice_id;