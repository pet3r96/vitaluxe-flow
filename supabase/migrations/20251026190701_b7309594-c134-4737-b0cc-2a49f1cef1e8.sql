-- Create a SECURITY DEFINER function to return rep earnings with proper authorization
CREATE OR REPLACE FUNCTION public.get_rep_earnings(_rep_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  earning_type text,
  description text,
  reference_number text,
  related_id uuid,
  amount numeric,
  payment_status text,
  paid_at timestamptz,
  payment_method text,
  payment_notes text,
  rep_id uuid,
  is_rx_required boolean,
  order_status text,
  doctor_id uuid,
  practice_name text,
  pdf_url text,
  invoice_number text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH authorized AS (
    SELECT 1
    FROM reps r
    WHERE r.id = _rep_id AND r.user_id = auth.uid()
    UNION ALL
    SELECT 1 WHERE has_role(auth.uid(), 'admin'::app_role)
    LIMIT 1
  )
  -- Product commissions (topline or downline perspective)
  SELECT
    op.id,
    op.created_at,
    'product_commission' AS earning_type,
    'Product Commission' AS description,
    'Order #' || substr(op.order_id::text, 1, 8) AS reference_number,
    op.order_id AS related_id,
    CASE 
      WHEN op.is_rx_required THEN 0
      WHEN op.topline_id = _rep_id THEN COALESCE(op.topline_profit, 0)
      WHEN op.downline_id = _rep_id THEN COALESCE(op.downline_profit, 0)
      ELSE 0
    END AS amount,
    COALESCE(op.payment_status::text, 'pending') AS payment_status,
    op.paid_at,
    NULL::text AS payment_method,
    NULL::text AS payment_notes,
    _rep_id AS rep_id,
    op.is_rx_required,
    o.status::text AS order_status,
    o.doctor_id,
    p.name AS practice_name,
    NULL::text AS pdf_url,
    NULL::text AS invoice_number
  FROM authorized, order_profits op
  JOIN orders o ON o.id = op.order_id
  JOIN profiles p ON p.id = o.doctor_id
  WHERE (_rep_id = op.topline_id OR _rep_id = op.downline_id)

  UNION ALL

  -- Practice Development Fees (topline only)
  SELECT
    pdf.id,
    COALESCE(pdf.paid_at, pdf.invoice_date) AS created_at,
    'practice_dev_fee' AS earning_type,
    'Practice Development Fee' AS description,
    pdf.invoice_number AS reference_number,
    pdf.id AS related_id,
    pdf.amount,
    pdf.payment_status::text AS payment_status,
    pdf.paid_at,
    pdf.payment_method,
    pdf.payment_notes,
    pdf.topline_rep_id AS rep_id,
    FALSE AS is_rx_required,
    NULL::text AS order_status,
    NULL::uuid AS doctor_id,
    r_prof.name AS practice_name,
    pdf.pdf_url,
    pdf.invoice_number
  FROM authorized, practice_development_fee_invoices pdf
  JOIN reps r ON pdf.topline_rep_id = r.id
  JOIN profiles r_prof ON r.user_id = r_prof.id
  WHERE pdf.payment_status IN ('paid') AND pdf.topline_rep_id = _rep_id
$$;

GRANT EXECUTE ON FUNCTION public.get_rep_earnings(uuid) TO authenticated;