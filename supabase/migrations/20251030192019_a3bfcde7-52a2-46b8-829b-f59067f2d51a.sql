-- Create RPC function to get practice hours with 9-5 M-F defaults
CREATE OR REPLACE FUNCTION public.get_practice_hours_with_defaults(p_practice_id UUID, p_day_of_week INTEGER)
RETURNS TABLE (
  start_time TIME,
  end_time TIME,
  is_closed BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Try to get configured hours first
  SELECT 
    pch.start_time::TIME,
    pch.end_time::TIME,
    pch.is_closed
  FROM practice_calendar_hours pch
  WHERE pch.practice_id = p_practice_id
    AND pch.day_of_week = p_day_of_week
  
  UNION ALL
  
  -- If no configured hours exist, return 9-5 M-F defaults
  SELECT 
    CASE 
      WHEN p_day_of_week BETWEEN 1 AND 5 THEN '09:00:00'::TIME  -- Mon-Fri: 9 AM
      ELSE '09:00:00'::TIME
    END as start_time,
    CASE 
      WHEN p_day_of_week BETWEEN 1 AND 5 THEN '17:00:00'::TIME  -- Mon-Fri: 5 PM
      ELSE '17:00:00'::TIME
    END as end_time,
    CASE 
      WHEN p_day_of_week BETWEEN 1 AND 5 THEN FALSE  -- Mon-Fri: Open
      ELSE TRUE  -- Sat-Sun: Closed
    END as is_closed
  WHERE NOT EXISTS (
    SELECT 1 FROM practice_calendar_hours 
    WHERE practice_id = p_practice_id AND day_of_week = p_day_of_week
  )
  
  LIMIT 1;
$$;

-- Create RPC function to get patient appointments with all details
CREATE OR REPLACE FUNCTION public.get_patient_appointments_with_details(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
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
        'name', practice_prof.name,
        'address_street', practice_prof.address_street,
        'address_city', practice_prof.address_city,
        'address_state', practice_prof.address_state
      ),
      'provider', CASE 
        WHEN provider_prof.name IS NOT NULL THEN
          jsonb_build_object(
            'name', provider_prof.name,
            'email', provider_prof.email
          )
        ELSE NULL
      END
    )
    ORDER BY pa.start_time
  )
  INTO result
  FROM patient_appointments pa
  JOIN patient_accounts patient_acc ON pa.patient_id = patient_acc.id
  JOIN profiles practice_prof ON pa.practice_id = practice_prof.id
  LEFT JOIN providers prov ON pa.provider_id = prov.id
  LEFT JOIN profiles provider_prof ON prov.user_id = provider_prof.id
  WHERE patient_acc.user_id = p_user_id;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;