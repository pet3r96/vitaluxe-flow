DROP FUNCTION IF EXISTS public.get_practice_patients(uuid);

CREATE OR REPLACE FUNCTION public.get_practice_patients(p_practice_id uuid)
RETURNS TABLE(
  id uuid, name text, first_name text, last_name text, email text, phone text,
  gender_at_birth text, address text, address_street text, address_suite text,
  address_city text, address_state text, address_zip text, address_formatted text,
  city text, state text, zip_code text, birth_date date, date_of_birth date,
  allergies text, notes text, address_verification_status text,
  address_verification_source text, practice_id uuid, provider_id uuid,
  created_at timestamptz, user_id uuid, last_login_at timestamptz, status text,
  practice_name text, practice_city text, practice_state text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    pa.id, pa.name, pa.first_name, pa.last_name, pa.email, pa.phone,
    pa.gender_at_birth, pa.address, pa.address_street, pa.address_suite,
    pa.address_city, pa.address_state, pa.address_zip, pa.address_formatted,
    pa.city, pa.state, pa.zip_code, pa.birth_date, pa.date_of_birth,
    pa.allergies, pa.notes, pa.address_verification_status,
    pa.address_verification_source, pa.practice_id, pa.provider_id,
    pa.created_at, pa.user_id, pa.last_login_at, pa.status,
    pr.name as practice_name, pr.address_city as practice_city,
    pr.address_state as practice_state
  FROM patient_accounts pa
  LEFT JOIN profiles pr ON pa.practice_id = pr.id
  WHERE
    pa.practice_id = p_practice_id
    OR
    pa.provider_id IN (
      SELECT prov.id FROM providers prov WHERE prov.practice_id = p_practice_id
    )
  ORDER BY pa.created_at DESC;
END;
$$;