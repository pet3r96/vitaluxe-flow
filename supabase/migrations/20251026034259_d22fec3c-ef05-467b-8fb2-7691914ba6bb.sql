-- Fix search_path for refresh_rep_productivity_summary function
CREATE OR REPLACE FUNCTION public.refresh_rep_productivity_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY rep_productivity_summary;
END;
$$;