-- Fix search_path for new functions
ALTER FUNCTION enforce_rx_pricing() SET search_path = public;
ALTER FUNCTION refresh_rep_productivity_summary() SET search_path = public;