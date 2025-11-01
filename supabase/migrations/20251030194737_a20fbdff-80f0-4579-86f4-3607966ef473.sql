-- Update get_practice_hours_with_defaults to read from appointment_settings
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
  settings RECORD;
  day_is_working BOOLEAN;
BEGIN
  -- Get appointment settings
  SELECT * INTO settings
  FROM appointment_settings
  WHERE practice_id = p_practice_id;
  
  -- If no settings found, return default 9-5 M-F
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
  
  -- Return the practice hours
  RETURN QUERY
  SELECT 
    (settings.start_hour || ':00:00')::TIME as start_time,
    (settings.end_hour || ':00:00')::TIME as end_time,
    NOT day_is_working as is_closed;
END;
$$;