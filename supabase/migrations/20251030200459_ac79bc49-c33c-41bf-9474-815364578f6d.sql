-- Fix get_patient_appointments_with_details to accept user_id instead of patient_id
DROP FUNCTION IF EXISTS public.get_patient_appointments_with_details(UUID);

CREATE OR REPLACE FUNCTION public.get_patient_appointments_with_details(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_result JSONB;
BEGIN
  -- Get patient_id from user_id
  SELECT id INTO v_patient_id
  FROM patient_accounts
  WHERE user_id = p_user_id;

  -- If no patient account found, return empty array
  IF v_patient_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  -- Get appointments with all details
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pa.id,
      'start_time', pa.start_time,
      'end_time', pa.end_time,
      'status', pa.status,
      'confirmation_type', pa.confirmation_type,
      'reason_for_visit', pa.reason_for_visit,
      'visit_type', pa.visit_type,
      'notes', pa.notes,
      'visit_summary_url', pa.visit_summary_url,
      'provider', CASE 
        WHEN prov.id IS NOT NULL THEN jsonb_build_object(
          'id', prov.id,
          'display_name', COALESCE(provider_prof.name, provider_prof.full_name, provider_prof.email, 'Provider')
        )
        ELSE NULL
      END,
      'practice', CASE
        WHEN practice_prof.id IS NOT NULL THEN jsonb_build_object(
          'id', practice_prof.id,
          'name', practice_prof.name,
          'address_street', practice_prof.address_street,
          'address_city', practice_prof.address_city,
          'address_state', practice_prof.address_state,
          'address_zip', practice_prof.address_zip
        )
        ELSE NULL
      END
    )
  ), '[]'::JSONB) INTO v_result
  FROM patient_appointments pa
  LEFT JOIN profiles practice_prof ON pa.practice_id = practice_prof.id
  LEFT JOIN providers prov ON pa.provider_id = prov.id
  LEFT JOIN profiles provider_prof ON prov.user_id = provider_prof.id
  WHERE pa.patient_id = v_patient_id
  ORDER BY pa.start_time DESC;

  RETURN v_result;
END;
$$;