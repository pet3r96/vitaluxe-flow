-- Recreate get_patient_appointments_with_details without referencing missing public.practices
DROP FUNCTION IF EXISTS public.get_patient_appointments_with_details(uuid);

CREATE OR REPLACE FUNCTION public.get_patient_appointments_with_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  -- Resolve patient_id from user_id
  SELECT id INTO v_patient_id
  FROM public.patient_accounts
  WHERE user_id = p_user_id;

  IF v_patient_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pa.id,
          'start_time', pa.start_time,
          'end_time', pa.end_time,
          'status', pa.status,
          'confirmation_type', pa.confirmation_type,
          'visit_type', pa.visit_type,
          'reason_for_visit', pa.reason_for_visit,
          'notes', pa.notes,
          'visit_summary_url', pa.visit_summary_url,
          'practice', jsonb_build_object(
            'id', pa.practice_id,
            'name', pb.practice_name,
            'address_street', NULL,
            'address_city', NULL,
            'address_state', NULL,
            'address_zip', NULL
          ),
          'provider', CASE 
            WHEN prov.id IS NOT NULL THEN jsonb_build_object(
              'id', prov.id,
              'display_name', COALESCE(prof.full_name, prof.name)
            )
            ELSE NULL
          END
        ) ORDER BY pa.start_time DESC
      ),
      '[]'::jsonb
    )
    FROM public.patient_appointments pa
    LEFT JOIN public.providers prov ON pa.provider_id = prov.id
    LEFT JOIN public.profiles prof ON prov.user_id = prof.id
    LEFT JOIN public.practice_branding pb ON pa.practice_id = pb.practice_id
    WHERE pa.patient_id = v_patient_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_appointments_with_details(uuid) TO authenticated;