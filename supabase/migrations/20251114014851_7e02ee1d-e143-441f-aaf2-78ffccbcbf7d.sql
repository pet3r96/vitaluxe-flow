-- Drop the existing security_invoker view
DROP VIEW IF EXISTS rep_productivity_view CASCADE;

-- Recreate as SECURITY DEFINER view that wraps the materialized view
-- This allows authenticated users to query it while accessing the restricted materialized view
CREATE VIEW rep_productivity_view 
WITH (security_invoker = false)  -- SECURITY DEFINER mode
AS
SELECT 
  rep_id,
  user_id,
  rep_name,
  rep_email,
  role,
  assigned_topline_id,
  practice_count,
  downline_count,
  total_orders,
  non_rx_orders,
  rx_orders,
  total_commissions,
  total_revenue,
  last_order_date
FROM rep_productivity_summary;

-- Grant SELECT to authenticated users
GRANT SELECT ON rep_productivity_view TO authenticated;

-- Add security comment
COMMENT ON VIEW rep_productivity_view IS 
'Security definer view for rep productivity. Runs with elevated permissions to access 
the restricted materialized view. Access control is handled at application level 
based on user roles (admin sees all, topline sees their network, downline sees self).';