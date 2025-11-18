-- PHASE 2: Backend & Database Performance Optimization
-- Batch 1: RPC Functions for N+1 Query Elimination
-- Batch 2: Strategic Composite Indexes
-- Batch 3: Dashboard Analytics Optimization

-- ========================================
-- BATCH 1: N+1 QUERY ELIMINATION RPCs
-- ========================================

-- 1.1: Get practice patients (replaces 3 sequential queries)
CREATE OR REPLACE FUNCTION get_practice_patients(p_practice_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  gender_at_birth TEXT,
  address TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_formatted TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  birth_date DATE,
  date_of_birth DATE,
  allergies TEXT,
  notes TEXT,
  address_verification_status TEXT,
  address_verification_source TEXT,
  practice_id UUID,
  provider_id UUID,
  created_at TIMESTAMPTZ,
  user_id UUID,
  last_login_at TIMESTAMPTZ,
  status TEXT,
  practice_name TEXT,
  practice_city TEXT,
  practice_state TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    pa.id,
    pa.name,
    pa.first_name,
    pa.last_name,
    pa.email,
    pa.phone,
    pa.gender_at_birth,
    pa.address,
    pa.address_street,
    pa.address_city,
    pa.address_state,
    pa.address_zip,
    pa.address_formatted,
    pa.city,
    pa.state,
    pa.zip_code,
    pa.birth_date,
    pa.date_of_birth,
    pa.allergies,
    pa.notes,
    pa.address_verification_status,
    pa.address_verification_source,
    pa.practice_id,
    pa.provider_id,
    pa.created_at,
    pa.user_id,
    pa.last_login_at,
    pa.status,
    pr.name as practice_name,
    pr.address_city as practice_city,
    pr.address_state as practice_state
  FROM patient_accounts pa
  LEFT JOIN profiles pr ON pa.practice_id = pr.id
  WHERE 
    -- Patients directly assigned to practice
    pa.practice_id = p_practice_id
    OR
    -- Patients assigned to providers in this practice
    pa.provider_id IN (
      SELECT prov.id 
      FROM providers prov 
      WHERE prov.practice_id = p_practice_id
    )
  ORDER BY pa.created_at DESC;
END;
$$;

-- 1.2: Get patient vault records grouped by type (replaces fetch + 8 filters)
CREATE OR REPLACE FUNCTION get_patient_vault_grouped(p_patient_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'medications', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'medication'
        ORDER BY created_at DESC
        LIMIT 50
      ) pmv
    ),
    'conditions', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'condition'
        ORDER BY created_at DESC
        LIMIT 50
      ) pmv
    ),
    'allergies', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'allergy'
        ORDER BY created_at DESC
        LIMIT 50
      ) pmv
    ),
    'vitals', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'vital'
        ORDER BY created_at DESC
        LIMIT 20
      ) pmv
    ),
    'immunizations', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'immunization'
        ORDER BY created_at DESC
        LIMIT 20
      ) pmv
    ),
    'surgeries', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'surgery'
        ORDER BY created_at DESC
        LIMIT 20
      ) pmv
    ),
    'pharmacies', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'pharmacy'
        ORDER BY created_at DESC
        LIMIT 10
      ) pmv
    ),
    'emergency_contacts', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'emergency_contact'
        ORDER BY created_at DESC
        LIMIT 5
      ) pmv
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ========================================
-- BATCH 2: STRATEGIC COMPOSITE INDEXES
-- ========================================

-- 2.1: Patient vault - most common query pattern
CREATE INDEX IF NOT EXISTS idx_patient_vault_type_created 
ON patient_medical_vault (patient_account_id, record_type, created_at DESC);

-- 2.2: Orders - dashboard and list queries
CREATE INDEX IF NOT EXISTS idx_orders_doctor_status_payment 
ON orders (doctor_id, status, payment_status, created_at DESC)
WHERE status != 'cancelled' AND payment_status != 'payment_failed';

-- 2.3: Video sessions - waiting room queries
CREATE INDEX IF NOT EXISTS idx_video_sessions_practice_scheduled 
ON video_sessions (practice_id, scheduled_start_time, status)
WHERE status IN ('created', 'scheduled', 'waiting', 'active');

-- 2.4: Order lines - top products aggregation
CREATE INDEX IF NOT EXISTS idx_order_lines_product_price 
ON order_lines (product_id, price) 
WHERE product_id IS NOT NULL;

-- ========================================
-- BATCH 3: DASHBOARD ANALYTICS OPTIMIZATION
-- ========================================

-- 3.1: Materialized view for top products
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_products AS
SELECT 
  p.id,
  p.name,
  COUNT(ol.id) as total_sales,
  SUM(ol.price) as total_revenue,
  AVG(ol.price) as avg_price
FROM products p
INNER JOIN order_lines ol ON ol.product_id = p.id
GROUP BY p.id, p.name
ORDER BY total_revenue DESC;

-- 3.2: Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_products_id 
ON mv_top_products (id);

CREATE INDEX IF NOT EXISTS idx_mv_top_products_revenue 
ON mv_top_products (total_revenue DESC);

-- 3.3: Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_top_products()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_products;
END;
$$;

-- 3.4: Efficient count function for dashboard
CREATE OR REPLACE FUNCTION count_doctor_orders(
  p_doctor_id UUID,
  p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  order_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO order_count
  FROM orders
  WHERE doctor_id = p_doctor_id
    AND status != 'cancelled'
    AND payment_status != 'payment_failed'
    AND created_at >= p_since;
  
  RETURN COALESCE(order_count, 0);
END;
$$;

-- ========================================
-- COMMENTS & METADATA
-- ========================================

COMMENT ON FUNCTION get_practice_patients IS 'Optimized function to fetch all patients for a practice (direct + provider-assigned) in a single query';
COMMENT ON FUNCTION get_patient_vault_grouped IS 'Optimized function to fetch and group patient medical vault records by type';
COMMENT ON FUNCTION refresh_top_products IS 'Refresh materialized view for top products analytics';
COMMENT ON FUNCTION count_doctor_orders IS 'Efficient count of non-cancelled orders for a doctor';

COMMENT ON INDEX idx_patient_vault_type_created IS 'Composite index for patient vault queries filtered by patient_id and record_type';
COMMENT ON INDEX idx_orders_doctor_status_payment IS 'Partial index for active orders queries on dashboard';
COMMENT ON INDEX idx_video_sessions_practice_scheduled IS 'Partial index for active video sessions in waiting room';
COMMENT ON INDEX idx_order_lines_product_price IS 'Index for product sales aggregation queries';