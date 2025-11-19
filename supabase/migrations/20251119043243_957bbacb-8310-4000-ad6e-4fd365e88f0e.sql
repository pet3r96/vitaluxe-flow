-- =====================================================
-- PHASE 3: PLATFORM SECURITY AUDIT MIGRATION
-- =====================================================

-- 1. View to check RLS is enabled on all tables
CREATE OR REPLACE VIEW security_audit_rls_status AS
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN c.relrowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status,
  CASE 
    WHEN c.relrowsecurity THEN '✅'
    ELSE '❌ SECURITY RISK'
  END as compliance
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
ORDER BY compliance DESC, tablename;

-- 2. View to check for unwanted public grants
CREATE OR REPLACE VIEW security_audit_public_grants AS
SELECT 
  table_schema,
  table_name,
  privilege_type,
  grantee,
  CASE 
    WHEN privilege_type IN ('INSERT', 'UPDATE', 'DELETE') THEN '❌ POTENTIAL RISK'
    ELSE '✅'
  END as compliance
FROM information_schema.table_privileges 
WHERE grantee = 'anon' 
  AND table_schema = 'public'
ORDER BY compliance DESC, table_name;

-- 3. View to check storage bucket security
CREATE OR REPLACE VIEW security_audit_storage_buckets AS
SELECT 
  id,
  name,
  CASE WHEN public THEN 'PUBLIC' ELSE 'PRIVATE' END as access_level,
  CASE 
    WHEN public THEN '❌ PUBLIC BUCKET'
    ELSE '✅'
  END as compliance,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
ORDER BY compliance DESC, name;

-- 4. Function to generate security audit report
CREATE OR REPLACE FUNCTION generate_security_audit_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report jsonb;
  rls_count integer;
  rls_disabled_count integer;
  public_grants_count integer;
  public_buckets_count integer;
BEGIN
  -- Count tables with RLS disabled
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables t
  WHERE t.schemaname = 'public';
  
  SELECT COUNT(*) INTO rls_disabled_count
  FROM pg_tables t
  LEFT JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
    AND (c.relrowsecurity IS NULL OR c.relrowsecurity = false);
  
  -- Count unwanted public grants
  SELECT COUNT(*) INTO public_grants_count
  FROM information_schema.table_privileges 
  WHERE grantee = 'anon' 
    AND table_schema = 'public'
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  
  -- Count public buckets
  SELECT COUNT(*) INTO public_buckets_count
  FROM storage.buckets
  WHERE public = true;
  
  -- Build report
  report := jsonb_build_object(
    'timestamp', NOW(),
    'summary', jsonb_build_object(
      'total_tables', rls_count,
      'rls_disabled_tables', rls_disabled_count,
      'unwanted_public_grants', public_grants_count,
      'public_buckets', public_buckets_count
    ),
    'compliance', jsonb_build_object(
      'rls_enabled', CASE WHEN rls_disabled_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END,
      'no_public_writes', CASE WHEN public_grants_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END,
      'all_buckets_private', CASE WHEN public_buckets_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
    ),
    'overall_status', CASE 
      WHEN rls_disabled_count = 0 AND public_grants_count = 0 AND public_buckets_count = 0 
      THEN '✅ PRODUCTION READY'
      ELSE '❌ SECURITY ISSUES DETECTED'
    END
  );
  
  RETURN report;
END;
$$;

-- 5. Table to log security audit history
CREATE TABLE IF NOT EXISTS security_audit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report_data JSONB NOT NULL,
  audited_by TEXT,
  notes TEXT
);

-- Enable RLS on security_audit_history
ALTER TABLE security_audit_history ENABLE ROW LEVEL SECURITY;

-- Only admins can read security audit history
CREATE POLICY "Admins can view security audit history"
  ON security_audit_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Only admins can insert security audit records
CREATE POLICY "Admins can insert security audit records"
  ON security_audit_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Add index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_security_audit_history_timestamp 
  ON security_audit_history(audit_timestamp DESC);

-- Add comments for documentation
COMMENT ON TABLE security_audit_history IS 'PHASE 3: Logs all security audit runs for compliance tracking';
COMMENT ON VIEW security_audit_rls_status IS 'PHASE 3: Shows RLS status for all public tables';
COMMENT ON VIEW security_audit_public_grants IS 'PHASE 3: Shows potentially dangerous public grants';
COMMENT ON VIEW security_audit_storage_buckets IS 'PHASE 3: Shows storage bucket security configuration';
COMMENT ON FUNCTION generate_security_audit_report() IS 'PHASE 3: Generates comprehensive security audit report';