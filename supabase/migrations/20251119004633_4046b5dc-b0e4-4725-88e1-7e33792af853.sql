-- Fix RPC function to refresh correct view name
DROP FUNCTION IF EXISTS refresh_rep_productivity_summary();

CREATE OR REPLACE FUNCTION refresh_rep_productivity_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY rep_productivity_view;
END;
$$;