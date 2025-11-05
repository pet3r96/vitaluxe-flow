-- Update get_practice_hours_with_defaults to prioritize practice_calendar_hours over appointment_settings
CREATE OR REPLACE FUNCTION public.get_practice_hours_with_defaults(p_practice_id UUID, p_day_of_week INTEGER)
RETURNS TABLE (
  start_time TIME,
  end_time TIME,
  is_closed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calendar_hours RECORD;
  settings RECORD;
  day_is_working BOOLEAN;
BEGIN
  -- First try to get custom per-day hours from practice_calendar_hours
  -- Handle both 0-6 (Sun=0) and 1-7 (Sun=7) day numbering
  SELECT * INTO calendar_hours
  FROM practice_calendar_hours
  WHERE practice_id = p_practice_id
    AND day_of_week IN (p_day_of_week, CASE WHEN p_day_of_week = 0 THEN 7 ELSE NULL END)
  LIMIT 1;
  
  -- If found custom hours, return them
  IF calendar_hours IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      calendar_hours.start_time,
      calendar_hours.end_time,
      calendar_hours.is_closed;
    RETURN;
  END IF;
  
  -- Otherwise, fall back to appointment_settings
  SELECT * INTO settings
  FROM appointment_settings
  WHERE practice_id = p_practice_id;
  
  -- If no settings found either, return default 9-5 M-F
  IF settings IS NULL THEN
    RETURN QUERY
    SELECT 
      '09:00:00'::TIME as start_time,
      '17:00:00'::TIME as end_time,
      CASE 
        WHEN p_day_of_week BETWEEN 1 AND 5 THEN FALSE
        ELSE TRUE
      END as is_closed;
    RETURN;
  END IF;
  
  -- Check if this day is in working_days array
  day_is_working := p_day_of_week = ANY(settings.working_days);
  
  -- Return the practice hours from settings
  RETURN QUERY
  SELECT 
    (settings.start_hour || ':00:00')::TIME as start_time,
    (settings.end_hour || ':00:00')::TIME as end_time,
    NOT day_is_working as is_closed;
END;
$$;