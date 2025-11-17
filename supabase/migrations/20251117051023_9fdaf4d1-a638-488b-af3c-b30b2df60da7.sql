-- ================================================================
-- PHASE 2: AUTOMATED RLS MONITORING SETUP
-- ================================================================

-- 1️⃣ Create audit results table
CREATE TABLE IF NOT EXISTS rls_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz DEFAULT now(),
  table_name text,
  rls_enabled boolean,
  policy_count int,
  has_select_policy boolean,
  details text
);

-- Enable RLS on audit table
ALTER TABLE rls_audit_results ENABLE ROW LEVEL SECURITY;

-- Admins can view audit results
CREATE POLICY "admins_view_rls_audits"
  ON rls_audit_results FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit results
CREATE POLICY "system_insert_rls_audits"
  ON rls_audit_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2️⃣ Function to check all tables nightly
CREATE OR REPLACE FUNCTION check_rls_integrity()
RETURNS void AS $$
DECLARE
  r RECORD;
  policy_count int;
  has_select boolean;
BEGIN
  FOR r IN
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname='public'
  LOOP
    -- Count total policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = r.tablename;
    
    -- Check for SELECT policy
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = r.tablename
        AND cmd = 'SELECT'
    ) INTO has_select;

    INSERT INTO rls_audit_results(table_name, rls_enabled, policy_count, has_select_policy, details)
    VALUES (
      r.tablename,
      r.rowsecurity,
      policy_count,
      has_select,
      CASE
        WHEN NOT r.rowsecurity THEN '⚠️ RLS DISABLED'
        WHEN policy_count = 0 THEN '⚠️ NO POLICIES'
        WHEN NOT has_select THEN '⚠️ NO SELECT POLICY'
        ELSE '✅ OK'
      END
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3️⃣ Create view for easy monitoring
CREATE OR REPLACE VIEW rls_audit_latest AS
SELECT 
  table_name,
  rls_enabled,
  policy_count,
  has_select_policy,
  details,
  checked_at
FROM rls_audit_results
WHERE checked_at > now() - interval '24 hours'
  AND details != '✅ OK'
ORDER BY checked_at DESC;