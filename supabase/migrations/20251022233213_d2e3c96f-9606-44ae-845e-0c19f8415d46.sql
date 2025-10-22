-- Ensure all existing public views use security_invoker for proper RLS
-- This addresses the security linter warning about SECURITY DEFINER views

-- Fix cart_lines_masked view
DROP VIEW IF EXISTS cart_lines_masked;
CREATE VIEW cart_lines_masked
WITH (security_invoker = true)
AS
SELECT id,
    cart_id,
    product_id,
    provider_id,
    patient_id,
    patient_name,
    CASE
        WHEN patient_email IS NOT NULL THEN (left(patient_email, 3) || '***@') || split_part(patient_email, '@', 2)
        ELSE NULL
    END AS patient_email_masked,
    CASE
        WHEN patient_phone IS NOT NULL THEN '***-***-' || right(patient_phone, 4)
        ELSE NULL
    END AS patient_phone_masked,
    CASE
        WHEN patient_address IS NOT NULL THEN left(patient_address, 10) || '...'
        ELSE NULL
    END AS patient_address_masked,
    CASE
        WHEN prescription_url IS NOT NULL THEN '[PRESCRIPTION ON FILE]'
        ELSE NULL
    END AS prescription_url_indicator,
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
FROM cart_lines;

-- Fix profiles_masked_for_reps view
DROP VIEW IF EXISTS profiles_masked_for_reps;
CREATE VIEW profiles_masked_for_reps
WITH (security_invoker = true)
AS
SELECT id,
    name,
    email,
    phone,
    address,
    company,
    active,
    created_at,
    updated_at,
    parent_id,
    linked_topline_id,
    address_verification_status,
    address_formatted,
    address_street,
    address_city,
    address_state,
    address_zip,
    email_encrypted,
    phone_encrypted,
    address_encrypted,
    NULL::text AS npi,
    NULL::text AS npi_encrypted,
    NULL::text AS dea,
    NULL::text AS dea_encrypted,
    NULL::text AS license_number,
    NULL::text AS license_number_encrypted,
    NULL::text AS full_name,
    NULL::text AS prescriber_name
FROM profiles;

-- Grant appropriate access
GRANT SELECT ON cart_lines_masked TO authenticated;
GRANT SELECT ON profiles_masked_for_reps TO authenticated;