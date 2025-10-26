-- Drop and recreate materialized view to exclude Rx profits from rep commissions
DROP MATERIALIZED VIEW IF EXISTS rep_productivity_summary CASCADE;

CREATE MATERIALIZED VIEW rep_productivity_summary AS
SELECT 
  r.id as rep_id,
  r.user_id,
  p.name as rep_name,
  p.email as rep_email,
  r.role,
  r.assigned_topline_id,
  COUNT(DISTINCT rpl.practice_id) as practice_count,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'cancelled') as total_orders,
  COUNT(DISTINCT CASE 
    WHEN prod.requires_prescription = false AND o.status != 'cancelled' 
    THEN o.id 
  END) as non_rx_orders,
  COUNT(DISTINCT CASE 
    WHEN prod.requires_prescription = true AND o.status != 'cancelled' 
    THEN o.id 
  END) as rx_orders,
  COALESCE(SUM(
    CASE 
      WHEN o.status != 'cancelled' AND op.is_rx_required = false THEN
        CASE 
          WHEN r.role = 'topline' THEN op.topline_profit 
          ELSE op.downline_profit 
        END
      ELSE 0
    END
  ), 0) as total_commissions,
  MAX(o.created_at) as last_order_date
FROM reps r
LEFT JOIN profiles p ON p.id = r.user_id
LEFT JOIN rep_practice_links rpl ON rpl.rep_id = r.id
LEFT JOIN orders o ON o.doctor_id = rpl.practice_id
LEFT JOIN order_lines ol ON ol.order_id = o.id
LEFT JOIN products prod ON prod.id = ol.product_id
LEFT JOIN order_profits op ON op.order_line_id = ol.id
GROUP BY r.id, r.user_id, p.name, p.email, r.role, r.assigned_topline_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX rep_productivity_summary_rep_id_idx ON rep_productivity_summary(rep_id);

-- Recreate the RLS-protected view wrapper
DROP VIEW IF EXISTS rep_productivity_view CASCADE;

CREATE VIEW rep_productivity_view AS
SELECT * FROM rep_productivity_summary;

-- Enable RLS on the view wrapper
ALTER VIEW rep_productivity_view SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON rep_productivity_view TO authenticated;