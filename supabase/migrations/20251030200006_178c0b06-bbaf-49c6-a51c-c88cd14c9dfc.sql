-- Fix get_patient_appointments_with_details to use profiles table instead of non-existent practices table
DROP FUNCTION IF EXISTS public.get_patient_appointments_with_details(UUID);

CREATE OR REPLACE FUNCTION public.get_patient_appointments_with_details(p_patient_id UUID)
RETURNS TABLE (
  id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  reason_for_visit TEXT,
  visit_type TEXT,
  provider_name TEXT,
  practice_name TEXT,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.id,
    pa.start_time,
    pa.end_time,
    pa.status,
    pa.reason_for_visit,
    pa.visit_type,
    COALESCE(provider_prof.name, provider_prof.full_name, provider_prof.email, 'Provider') as provider_name,
    practice_prof.name as practice_name,
    pa.notes
  FROM patient_appointments pa
  LEFT JOIN profiles practice_prof ON pa.practice_id = practice_prof.id
  LEFT JOIN providers prov ON pa.provider_id = prov.id
  LEFT JOIN profiles provider_prof ON prov.user_id = provider_prof.id
  WHERE pa.patient_id = p_patient_id
  ORDER BY pa.start_time DESC;
END;
$$;