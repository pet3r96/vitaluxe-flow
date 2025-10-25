-- Fix addresses_missing_state view to use SECURITY INVOKER
-- This ensures RLS policies are enforced and prevents unauthorized data access

DROP VIEW IF EXISTS addresses_missing_state;

CREATE VIEW addresses_missing_state
WITH (security_invoker = true)
AS
SELECT 'patients'::text AS table_name,
    patients.id,
    patients.name AS record_name,
    'address_state'::text AS missing_field
FROM patients
WHERE ((address_formatted IS NOT NULL OR address_street IS NOT NULL) 
       AND address_state IS NULL)
UNION ALL
SELECT 'pharmacies'::text AS table_name,
    pharmacies.id,
    pharmacies.name AS record_name,
    'address_state'::text AS missing_field
FROM pharmacies
WHERE ((address IS NOT NULL OR address_street IS NOT NULL) 
       AND address_state IS NULL)
UNION ALL
SELECT 'profiles'::text AS table_name,
    profiles.id,
    COALESCE(profiles.full_name, profiles.email) AS record_name,
    'address_state'::text AS missing_field
FROM profiles
WHERE (address IS NOT NULL AND address_state IS NULL)
UNION ALL
SELECT 'profiles'::text AS table_name,
    profiles.id,
    COALESCE(profiles.full_name, profiles.email) AS record_name,
    'shipping_address_state'::text AS missing_field
FROM profiles
WHERE ((shipping_address_formatted IS NOT NULL OR shipping_address_street IS NOT NULL) 
       AND shipping_address_state IS NULL);