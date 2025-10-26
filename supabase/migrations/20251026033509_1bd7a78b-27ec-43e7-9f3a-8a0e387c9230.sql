-- Phase 3: Create materialized view for rep productivity tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS rep_productivity_summary AS
SELECT 
  r.id as rep_id,
  r.user_id,
  p.name as rep_name,
  p.email as rep_email,
  r.role,
  r.assigned_topline_id,
  COUNT(DISTINCT rpl.practice_id) as practice_count,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'cancelled') as total_orders,
  COUNT(DISTINCT CASE WHEN prod.requires_prescription = false AND o.status != 'cancelled' THEN o.id END) as non_rx_orders,
  COUNT(DISTINCT CASE WHEN prod.requires_prescription = true AND o.status != 'cancelled' THEN o.id END) as rx_orders,
  COALESCE(SUM(
    CASE 
      WHEN o.status != 'cancelled' THEN
        CASE 
          WHEN r.role = 'topline' THEN op.topline_profit 
          ELSE op.downline_profit 
        END
      ELSE 0
    END
  ), 0) as total_commissions,
  MAX(o.created_at) as last_order_date
FROM reps r
JOIN profiles p ON r.user_id = p.id
LEFT JOIN rep_practice_links rpl ON r.id = rpl.rep_id
LEFT JOIN orders o ON o.doctor_id = rpl.practice_id
LEFT JOIN order_lines ol ON ol.order_id = o.id
LEFT JOIN products prod ON ol.product_id = prod.id
LEFT JOIN order_profits op ON op.order_line_id = ol.id
WHERE r.role IN ('topline', 'downline')
GROUP BY r.id, r.user_id, p.name, p.email, r.role, r.assigned_topline_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_rep_productivity_rep_id ON rep_productivity_summary(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_productivity_topline ON rep_productivity_summary(assigned_topline_id);
CREATE INDEX IF NOT EXISTS idx_rep_productivity_role ON rep_productivity_summary(role);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_rep_productivity_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY rep_productivity_summary;
END;
$$;