-- ============================================================================
-- UNIFIED LOG RETENTION SYSTEM - CORRECTED IMPLEMENTATION (FIXED)
-- ============================================================================

-- Phase 1: Create Archive Tables with Corrected Schemas
-- ============================================================================

-- 1. Medical Vault Audit Logs Archive (30 days → 6 years)
CREATE TABLE IF NOT EXISTS medical_vault_audit_logs_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_log_id uuid,
  patient_account_id uuid,
  action_type text,
  entity_type text,
  entity_id uuid,
  entity_name text,
  changed_by_user_id uuid,
  changed_by_role text,
  old_data jsonb,
  new_data jsonb,
  change_summary text,
  created_at timestamptz,
  archived_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mv_archive_patient ON medical_vault_audit_logs_archive(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_mv_archive_created ON medical_vault_audit_logs_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_mv_archive_archived ON medical_vault_audit_logs_archive(archived_at);

-- 2. Shipping Audit Logs Archive (30 days → 3 years)
CREATE TABLE IF NOT EXISTS shipping_audit_logs_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_log_id uuid,
  order_line_id uuid,
  updated_by uuid,
  updated_by_role text,
  old_tracking_number text,
  new_tracking_number text,
  old_carrier text,
  new_carrier text,
  old_status text,
  new_status text,
  change_description text,
  created_at timestamptz,
  archived_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ship_archive_created ON shipping_audit_logs_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_ship_archive_archived ON shipping_audit_logs_archive(archived_at);

-- 3. Error Logs Archive (30 days → 90 days)
CREATE TABLE IF NOT EXISTS error_logs_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_log_id uuid,
  severity text,
  source text,
  error_message text,
  error_stack text,
  user_id uuid,
  practice_id uuid,
  details jsonb,
  created_at timestamptz,
  archived_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_archive_created ON error_logs_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_error_archive_severity ON error_logs_archive(severity);

-- Phase 2: Create/Replace Unified archive_all_logs() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_all_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  archived_count int;
  purged_count int;
BEGIN
  -- 1. Audit Logs → archive (30 days → 6 years)
  PERFORM archive_old_audit_logs();
  result := result || jsonb_build_object('audit_logs_archived', true);

  -- 2. Medical Vault Logs → archive (30 days → 6 years)
  INSERT INTO medical_vault_audit_logs_archive (
    original_log_id, patient_account_id, action_type, entity_type,
    entity_id, entity_name, changed_by_user_id, changed_by_role,
    old_data, new_data, change_summary, created_at, archived_at
  )
  SELECT 
    id, patient_account_id, action_type, entity_type,
    entity_id, entity_name, changed_by_user_id, changed_by_role,
    old_data, new_data, change_summary, created_at, now()
  FROM medical_vault_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  DELETE FROM medical_vault_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';

  result := result || jsonb_build_object('medical_vault_archived', archived_count);

  -- 3. Shipping Logs → archive (30 days → 3 years)
  INSERT INTO shipping_audit_logs_archive (
    original_log_id, order_line_id, updated_by, updated_by_role,
    old_tracking_number, new_tracking_number, old_carrier, new_carrier,
    old_status, new_status, change_description, created_at, archived_at
  )
  SELECT 
    id, order_line_id, updated_by, updated_by_role::text,
    old_tracking_number, new_tracking_number, 
    old_carrier::text, new_carrier::text,
    old_status::text, new_status::text, 
    change_description, created_at, now()
  FROM shipping_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  DELETE FROM shipping_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';

  result := result || jsonb_build_object('shipping_logs_archived', archived_count);

  -- 4. Error Logs → archive (30 days → 90 days)
  INSERT INTO error_logs_archive (
    original_log_id, severity, source, error_message, error_stack,
    user_id, practice_id, details, created_at, archived_at
  )
  SELECT 
    id,
    CASE 
      WHEN action_type LIKE '%critical%' THEN 'critical'
      WHEN action_type LIKE '%warn%' THEN 'warning'
      ELSE 'error'
    END as severity,
    entity_type as source,
    details->>'error_message' as error_message,
    details->>'error_stack' as error_stack,
    user_id,
    (details->>'practiceId')::uuid as practice_id,
    details,
    created_at,
    now()
  FROM audit_logs
  WHERE action_type LIKE '%error%'
    AND created_at < now() - INTERVAL '30 days'
    AND (details->>'isSystemMaintenance' IS NULL OR details->>'isSystemMaintenance' != 'true');

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  DELETE FROM audit_logs
  WHERE action_type LIKE '%error%'
    AND created_at < now() - INTERVAL '30 days'
    AND (details->>'isSystemMaintenance' IS NULL OR details->>'isSystemMaintenance' != 'true');

  result := result || jsonb_build_object('error_logs_archived', archived_count);

  -- 5. 2FA Logs → purge (90 days retention)
  DELETE FROM two_fa_audit_log
  WHERE created_at < now() - INTERVAL '90 days';

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  result := result || jsonb_build_object('two_fa_purged', purged_count);

  -- 6. Video Sessions → purge (30 days retention)
  DELETE FROM video_sessions
  WHERE created_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  result := result || jsonb_build_object('video_sessions_purged', purged_count);

  -- 7. Purge old archived data (compliance retention limits)
  DELETE FROM medical_vault_audit_logs_archive
  WHERE created_at < now() - INTERVAL '6 years';

  DELETE FROM shipping_audit_logs_archive
  WHERE created_at < now() - INTERVAL '3 years';

  DELETE FROM error_logs_archive
  WHERE created_at < now() - INTERVAL '90 days';

  DELETE FROM audit_logs_archive
  WHERE created_at < now() - INTERVAL '6 years';

  RETURN result;
END;
$$;

-- Phase 3: Enable RLS and Drop Existing Policies
-- ============================================================================

ALTER TABLE medical_vault_audit_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_audit_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins view medical vault archive" ON medical_vault_audit_logs_archive;
DROP POLICY IF EXISTS "Admins view shipping archive" ON shipping_audit_logs_archive;
DROP POLICY IF EXISTS "Admins view error archive" ON error_logs_archive;

-- Phase 4: Create Admin-Only RLS Policies
-- ============================================================================

CREATE POLICY "Admins view medical vault archive"
  ON medical_vault_audit_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin'::app_role, 'super_admin'::app_role)
    )
  );

CREATE POLICY "Admins view shipping archive"
  ON shipping_audit_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin'::app_role, 'super_admin'::app_role)
    )
  );

CREATE POLICY "Admins view error archive"
  ON error_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin'::app_role, 'super_admin'::app_role)
    )
  );

-- Phase 5: Schedule Daily Cron Job (2:00 AM UTC)
-- ============================================================================

DO $$
BEGIN
  -- Remove old cron job if exists
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-logs-daily') THEN
    PERFORM cron.unschedule('cleanup-logs-daily');
  END IF;
END $$;

-- Create new unified cleanup cron
SELECT cron.schedule(
  'cleanup-logs-daily',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/cleanup-logs',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidHNmYWpzaG5yd3dsZnprZW9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDExMSwiZXhwIjoyMDc1NTcwMTExfQ.5YnRg3n6lOAZYg9MHOyxfMcdqnjdRFXoM5-WD4X-3Ss"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON FUNCTION archive_all_logs() IS 
'Unified log retention function with corrected schemas. Archives logs to compliance storage and purges old data. Runs daily at 2:00 AM UTC. Retention: Medical Vault (6yr), Shipping (3yr), Audit (6yr), Error (90d), 2FA (90d), Video (30d). Excludes system maintenance logs from recursive archiving.';