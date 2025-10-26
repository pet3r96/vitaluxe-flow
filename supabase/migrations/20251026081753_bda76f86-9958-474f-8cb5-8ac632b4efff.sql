-- Create a unified view for rep earnings (product commissions + practice dev fees)
CREATE OR REPLACE VIEW rep_earnings_view AS
-- Product commissions from order_profits
SELECT 
  op.id,
  op.created_at,
  'product_commission' as earning_type,
  'Product Commission' as description,
  CONCAT('Order #', SUBSTRING(op.order_id::text, 1, 8)) as reference_number,
  op.order_id as related_id,
  CASE 
    WHEN op.topline_id IS NOT NULL AND op.downline_id IS NULL THEN op.topline_profit
    WHEN op.downline_id IS NOT NULL THEN op.downline_profit
    ELSE 0
  END as amount,
  op.payment_status::text as payment_status,
  NULL::timestamp with time zone as paid_at,
  NULL::text as payment_method,
  NULL::text as payment_notes,
  op.topline_id as rep_id,
  op.is_rx_required,
  o.status::text as order_status,
  o.doctor_id,
  p.name as practice_name,
  NULL::text as pdf_url,
  NULL::text as invoice_number
FROM order_profits op
JOIN orders o ON op.order_id = o.id
JOIN profiles p ON o.doctor_id = p.id
WHERE op.topline_id IS NOT NULL

UNION ALL

-- Practice Development Fees
SELECT 
  pdf.id,
  COALESCE(pdf.paid_at, pdf.invoice_date) as created_at,
  'practice_dev_fee' as earning_type,
  'Practice Development Fee' as description,
  pdf.invoice_number as reference_number,
  pdf.id as related_id,
  pdf.amount,
  pdf.payment_status::text as payment_status,
  pdf.paid_at,
  pdf.payment_method,
  pdf.payment_notes,
  pdf.topline_rep_id as rep_id,
  FALSE as is_rx_required,
  NULL::text as order_status,
  NULL::uuid as doctor_id,
  r_prof.name as practice_name,
  pdf.pdf_url,
  pdf.invoice_number
FROM practice_development_fee_invoices pdf
JOIN reps r ON pdf.topline_rep_id = r.id
JOIN profiles r_prof ON r.user_id = r_prof.id
WHERE pdf.payment_status = 'paid';

-- Grant access
GRANT SELECT ON rep_earnings_view TO authenticated;

-- Enable RLS on the view
ALTER VIEW rep_earnings_view SET (security_invoker = true);