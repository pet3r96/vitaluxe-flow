-- ============================================================================
-- FINAL SECURITY FIX - Update Views with Correct Definitions
-- ============================================================================

-- FIX 1: patient_account_health - Remove auth.users exposure
DROP VIEW IF EXISTS public.patient_account_health CASCADE;
CREATE VIEW public.patient_account_health AS
SELECT 
  pa.id AS patient_id,
  pa.first_name || ' ' || pa.last_name AS name,
  pa.email,
  pa.practice_id,
  p.name AS practice_name,
  pa.invitation_sent_at,
  pa.status AS account_status,
  CASE
    WHEN pa.user_id IS NOT NULL THEN 'linked'
    ELSE 'not_invited'
  END AS link_status,
  pa.created_at,
  pa.updated_at
FROM patient_accounts pa
LEFT JOIN profiles p ON p.id = pa.practice_id;

-- FIX 2: rep_productivity_view - Add security_invoker
DROP VIEW IF EXISTS public.rep_productivity_view CASCADE;
CREATE VIEW public.rep_productivity_view
WITH (security_invoker=true) AS
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
FROM public.rep_productivity_summary;

-- FIX 3: rep_earnings_view - Add security_invoker
DROP VIEW IF EXISTS public.rep_earnings_view CASCADE;
CREATE VIEW public.rep_earnings_view
WITH (security_invoker=true) AS
SELECT op.id,
    op.created_at,
    'product_commission'::text AS earning_type,
    'Product Commission'::text AS description,
    concat('Order #', "substring"((op.order_id)::text, 1, 8)) AS reference_number,
    op.order_id AS related_id,
    op.topline_profit AS amount,
    (op.payment_status)::text AS payment_status,
    NULL::timestamp with time zone AS paid_at,
    NULL::text AS payment_method,
    NULL::text AS payment_notes,
    op.topline_id AS rep_id,
    op.is_rx_required,
    o.status AS order_status,
    o.doctor_id,
    p.name AS practice_name,
    NULL::text AS pdf_url,
    NULL::text AS invoice_number
   FROM ((order_profits op
     JOIN orders o ON ((op.order_id = o.id)))
     JOIN profiles p ON ((o.doctor_id = p.id)))
  WHERE (op.topline_id IS NOT NULL)
UNION ALL
 SELECT op.id,
    op.created_at,
    'product_commission'::text AS earning_type,
    'Product Commission'::text AS description,
    concat('Order #', "substring"((op.order_id)::text, 1, 8)) AS reference_number,
    op.order_id AS related_id,
    op.downline_profit AS amount,
    (op.payment_status)::text AS payment_status,
    NULL::timestamp with time zone AS paid_at,
    NULL::text AS payment_method,
    NULL::text AS payment_notes,
    op.downline_id AS rep_id,
    op.is_rx_required,
    o.status AS order_status,
    o.doctor_id,
    p.name AS practice_name,
    NULL::text AS pdf_url,
    NULL::text AS invoice_number
   FROM ((order_profits op
     JOIN orders o ON ((op.order_id = o.id)))
     JOIN profiles p ON ((o.doctor_id = p.id)))
  WHERE (op.downline_id IS NOT NULL)
UNION ALL
 SELECT pdf.id,
    COALESCE(pdf.paid_at, pdf.invoice_date) AS created_at,
    'practice_dev_fee'::text AS earning_type,
    'Practice Development Fee'::text AS description,
    pdf.invoice_number AS reference_number,
    pdf.id AS related_id,
    pdf.amount,
    pdf.payment_status,
    pdf.paid_at,
    pdf.payment_method,
    pdf.payment_notes,
    pdf.topline_rep_id AS rep_id,
    false AS is_rx_required,
    NULL::text AS order_status,
    NULL::uuid AS doctor_id,
    r_prof.name AS practice_name,
    pdf.pdf_url,
    pdf.invoice_number
   FROM ((practice_development_fee_invoices pdf
     JOIN reps r ON ((pdf.topline_rep_id = r.id)))
     JOIN profiles r_prof ON ((r.user_id = r_prof.id)))
  WHERE (pdf.payment_status = 'paid'::text);

-- FIX 4: user_2fa_settings_decrypted - Add security_invoker
DROP VIEW IF EXISTS public.user_2fa_settings_decrypted CASCADE;
CREATE VIEW public.user_2fa_settings_decrypted
WITH (security_invoker=true) AS
SELECT id,
    user_id,
    phone_number,
    phone_verified,
    is_enrolled,
    created_at,
    updated_at
   FROM user_2fa_settings;

-- FIX 5: profiles_masked_for_reps - Add security_invoker
DROP VIEW IF EXISTS public.profiles_masked_for_reps CASCADE;
CREATE VIEW public.profiles_masked_for_reps
WITH (security_invoker=true) AS
SELECT id,
    name,
    email,
    phone,
    address,
    company,
    active,
    created_at,
    updated_at,
    parent_id,
    linked_topline_id,
    address_verification_status,
    address_formatted,
    address_street,
    address_city,
    address_state,
    address_zip,
    email_encrypted,
    phone_encrypted,
    address_encrypted,
    NULL::text AS npi,
    NULL::text AS npi_encrypted,
    NULL::text AS dea,
    NULL::text AS dea_encrypted,
    NULL::text AS license_number,
    NULL::text AS license_number_encrypted,
    NULL::text AS full_name,
    NULL::text AS prescriber_name
   FROM profiles;

-- FIX 6: cart_lines_masked - Add security_invoker
DROP VIEW IF EXISTS public.cart_lines_masked CASCADE;
CREATE VIEW public.cart_lines_masked
WITH (security_invoker=true) AS
SELECT id,
    cart_id,
    product_id,
    provider_id,
    patient_id,
    patient_name,
        CASE
            WHEN (patient_email IS NOT NULL) THEN (("left"(patient_email, 3) || '***@'::text) || split_part(patient_email, '@'::text, 2))
            ELSE NULL::text
        END AS patient_email_masked,
        CASE
            WHEN (patient_phone IS NOT NULL) THEN ('***-***-'::text || "right"(patient_phone, 4))
            ELSE NULL::text
        END AS patient_phone_masked,
        CASE
            WHEN (patient_address IS NOT NULL) THEN ("left"(patient_address, 10) || '...'::text)
            ELSE NULL::text
        END AS patient_address_masked,
        CASE
            WHEN (prescription_url IS NOT NULL) THEN '[PRESCRIPTION ON FILE]'::text
            ELSE NULL::text
        END AS prescription_url_indicator,
    prescription_method,
    order_notes,
    destination_state,
    quantity,
    price_snapshot,
    refills_allowed,
    refills_total,
    refills_remaining,
    created_at,
    expires_at
   FROM cart_lines;