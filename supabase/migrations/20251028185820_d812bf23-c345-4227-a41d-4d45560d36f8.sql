-- Fix patient portal access for legacy patients with case-sensitive email mismatches

-- 1. Add invitation_sent_at column to patient_accounts if missing
ALTER TABLE patient_accounts 
ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;

-- 2. Normalize legacy email data to lowercase (idempotent)
UPDATE patients 
SET email = lower(trim(email)) 
WHERE email IS NOT NULL AND email <> lower(trim(email));

UPDATE patient_accounts 
SET email = lower(trim(email)) 
WHERE email IS NOT NULL AND email <> lower(trim(email));

-- 3. Add functional index for fast case-insensitive email lookups
CREATE INDEX IF NOT EXISTS idx_patient_accounts_email_lower 
ON patient_accounts (lower(email));

CREATE INDEX IF NOT EXISTS idx_patients_email_lower 
ON patients (lower(email));

-- 4. Drop and recreate v_patients_with_portal_status with case-insensitive join
DROP VIEW IF EXISTS v_patients_with_portal_status;

CREATE VIEW v_patients_with_portal_status 
WITH (security_invoker = true) AS
SELECT 
  p.id as patient_id,
  p.practice_id,
  p.name,
  p.email,
  p.phone,
  p.birth_date,
  p.address,
  p.address_city as city,
  p.address_state as state,
  p.address_zip as zip_code,
  pa.id as patient_account_id,
  pa.user_id,
  pa.status as portal_status,
  pa.last_login_at,
  CASE 
    WHEN pa.id IS NOT NULL THEN true 
    ELSE false 
  END as has_portal_access,
  pa.created_at as portal_created_at,
  pa.invitation_sent_at
FROM patients p
LEFT JOIN patient_accounts pa 
  ON lower(p.email) = lower(pa.email) 
  AND p.practice_id = pa.practice_id
ORDER BY p.name;