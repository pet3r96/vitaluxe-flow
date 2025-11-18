-- Create rep_productivity_summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS rep_productivity_summary AS
SELECT 
  r.id as rep_id,
  r.user_id,
  p.name as rep_name,
  p.email as rep_email,
  r.role as rep_role,
  -- Practice count
  COUNT(DISTINCT CASE WHEN pr.linked_topline_id = r.user_id THEN pr.id END) as practice_count,
  -- Downline count (for topline reps)
  COUNT(DISTINCT CASE WHEN r.role = 'topline' THEN dr.id END) as downline_count,
  -- Order statistics
  COUNT(DISTINCT CASE WHEN prod.requires_prescription = false THEN o.id END) as non_rx_orders,
  COUNT(DISTINCT CASE WHEN prod.requires_prescription = true THEN o.id END) as rx_orders,
  COUNT(DISTINCT o.id) as total_orders,
  -- Revenue
  COALESCE(SUM(o.total_amount), 0) as total_revenue,
  -- Commissions
  COALESCE(SUM(op.topline_profit), 0) + COALESCE(SUM(op.downline_profit), 0) as total_commissions,
  -- Average order value
  CASE 
    WHEN COUNT(DISTINCT o.id) > 0 THEN COALESCE(SUM(o.total_amount), 0) / COUNT(DISTINCT o.id)
    ELSE 0 
  END as avg_order_value
FROM reps r
INNER JOIN profiles p ON p.id = r.user_id
LEFT JOIN profiles pr ON pr.linked_topline_id = r.user_id
LEFT JOIN orders o ON o.practice_id = pr.id AND o.payment_status IN ('paid', 'captured')
LEFT JOIN order_lines ol ON ol.order_id = o.id
LEFT JOIN products prod ON prod.id = ol.product_id
LEFT JOIN order_profits op ON op.order_id = o.id AND (op.topline_id = r.id OR op.downline_id = r.id)
LEFT JOIN reps dr ON dr.assigned_topline_id = r.id AND r.role = 'topline'
GROUP BY r.id, r.user_id, p.name, p.email, r.role;

-- Create index for fast queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_rep_productivity_summary_rep_id ON rep_productivity_summary(rep_id);

-- Grant select permissions
GRANT SELECT ON rep_productivity_summary TO authenticated;