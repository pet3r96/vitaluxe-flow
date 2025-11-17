-- =====================================================
-- Batch 14-15: FINAL - Performance + RLS Monitoring
-- =====================================================

-- =====================================================
-- STEP 1: FIX DUPLICATE POLICIES
-- =====================================================

-- Drop and recreate with correct names
DROP POLICY IF EXISTS "Admins can manage all" ON amazon_tracking_api_calls;
DROP POLICY IF EXISTS "Admins can manage all" ON practice_subscriptions;
DROP POLICY IF EXISTS "staff_view_practice_messages" ON messages;

-- Recreate with table-specific names
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'amazon_tracking_api_calls' 
    AND policyname = 'Admins can manage all tracking calls'
  ) THEN
    CREATE POLICY "Admins can manage all tracking calls"
      ON amazon_tracking_api_calls FOR ALL 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages' 
    AND policyname = 'Staff can view threaded messages'
  ) THEN
    CREATE POLICY "Staff can view threaded messages"
      ON messages FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM practice_staff 
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- =====================================================
-- STEP 2: PERFORMANCE INDEXES (8 total)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_vault_patient_type_date 
ON patient_medical_vault(patient_account_id, record_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_practice_resolved 
ON patient_messages(practice_id, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_date 
ON orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_thread 
ON messages(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy 
ON order_lines(assigned_pharmacy_id, status);

CREATE INDEX IF NOT EXISTS idx_rate_limits_function_user_time 
ON function_rate_limits(function_name, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_practice_status 
ON patient_accounts(practice_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time 
ON audit_logs(action_type, created_at DESC);

-- =====================================================
-- STEP 3: RLS MONITORING INFRASTRUCTURE
-- =====================================================

-- Materialized View: Complete policy snapshot
DROP MATERIALIZED VIEW IF EXISTS rls_policy_export CASCADE;
CREATE MATERIALIZED VIEW rls_policy_export AS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

CREATE UNIQUE INDEX idx_rls_policy_export_table_policy 
ON rls_policy_export(tablename, policyname);

-- View: Policies grouped by table (JSON)
DROP VIEW IF EXISTS rls_policy_matrix CASCADE;
CREATE VIEW rls_policy_matrix AS
SELECT 
  tablename,
  jsonb_agg(
    jsonb_build_object(
      'policy_name', policyname,
      'command', cmd,
      'roles', roles,
      'permissive', permissive,
      'using', qual,
      'with_check', with_check
    ) ORDER BY policyname
  ) AS policies,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- View: Security coverage status
DROP VIEW IF EXISTS rls_policy_coverage CASCADE;
CREATE VIEW rls_policy_coverage AS
SELECT 
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COALESCE(p.policy_count, 0) AS policy_count,
  COALESCE(p.has_select, false) AS has_select_policy,
  CASE 
    WHEN NOT t.rowsecurity THEN 'RLS_DISABLED'
    WHEN COALESCE(p.policy_count, 0) = 0 THEN 'NO_POLICIES'
    WHEN NOT COALESCE(p.has_select, false) THEN 'MISSING_SELECT'
    ELSE 'OK'
  END AS status
FROM pg_tables t
LEFT JOIN (
  SELECT 
    tablename,
    COUNT(*) AS policy_count,
    bool_or(cmd = 'SELECT') AS has_select
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
ORDER BY 
  CASE 
    WHEN NOT t.rowsecurity THEN 1
    WHEN COALESCE(p.policy_count, 0) = 0 THEN 2
    WHEN NOT COALESCE(p.has_select, false) THEN 3
    ELSE 4
  END,
  t.tablename;

-- Function: Refresh materialized view
CREATE OR REPLACE FUNCTION refresh_rls_policy_export()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY rls_policy_export;
END;
$$;