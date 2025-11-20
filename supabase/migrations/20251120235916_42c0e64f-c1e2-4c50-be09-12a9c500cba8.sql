-- Update get_practice_hours_with_defaults to remove appointment_settings reference
CREATE OR REPLACE FUNCTION public.get_practice_hours_with_defaults(
  p_practice_id UUID,
  p_day_of_week INTEGER
)
RETURNS TABLE (
  start_time TIME,
  end_time TIME,
  is_closed BOOLEAN
)
AS $$
DECLARE
  calendar_hours RECORD;
BEGIN
  -- Try to get custom per-day hours from practice_calendar_hours
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
  
  -- Otherwise, return default 9-5 M-F (closed weekends)
  RETURN QUERY
  SELECT 
    '09:00:00'::TIME as start_time,
    '17:00:00'::TIME as end_time,
    CASE 
      WHEN p_day_of_week BETWEEN 1 AND 5 THEN FALSE
      ELSE TRUE
    END as is_closed;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;