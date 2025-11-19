-- Fix order_profits unique constraint to enable upsert
ALTER TABLE order_profits
ADD CONSTRAINT order_profits_order_id_unique UNIQUE (order_id);

-- Drop and recreate rep_productivity_view with correct column name
DROP MATERIALIZED VIEW IF EXISTS rep_productivity_view CASCADE;

CREATE MATERIALIZED VIEW rep_productivity_view AS
SELECT 
  r.id as rep_id,
  r.user_id,
  r.role,  -- Changed from rep_role to match frontend query
  p.name as rep_name,
  p.email as rep_email,
  COUNT(DISTINCT CASE WHEN prof.linked_topline_id = r.user_id THEN prof.id END) as practice_count,
  COUNT(DISTINCT CASE WHEN dr.assigned_topline_id = r.id THEN dr.id END) as downline_count,
  COUNT(DISTINCT CASE WHEN prod.requires_prescription = FALSE THEN o.id END) as non_rx_orders,
  COUNT(DISTINCT CASE WHEN prod.requires_prescription = TRUE THEN o.id END) as rx_orders,
  COUNT(DISTINCT o.id) as total_orders,
  COALESCE(SUM(o.total_amount), 0) as total_revenue,
  COALESCE(SUM(op.topline_profit + COALESCE(op.downline_profit, 0)), 0) as total_commissions,
  CASE 
    WHEN COUNT(DISTINCT o.id) > 0 
    THEN COALESCE(SUM(o.total_amount) / COUNT(DISTINCT o.id), 0)
    ELSE 0 
  END as avg_order_value
FROM reps r
LEFT JOIN profiles p ON p.id = r.user_id
LEFT JOIN reps dr ON dr.assigned_topline_id = r.id AND dr.role = 'downline'
LEFT JOIN profiles prof ON prof.linked_topline_id = r.user_id
LEFT JOIN orders o ON o.doctor_id = prof.id AND o.payment_status = 'paid'
LEFT JOIN order_lines ol ON ol.order_id = o.id
LEFT JOIN products prod ON prod.id = ol.product_id
LEFT JOIN order_profits op ON op.order_id = o.id AND (op.topline_id = r.id OR op.downline_id = r.id)
GROUP BY r.id, r.user_id, r.role, p.name, p.email;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_rep_productivity_view_rep_id ON rep_productivity_view(rep_id);