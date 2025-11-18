-- =====================================================
-- UNIFIED LOG RETENTION SYSTEM
-- Creates 3 archive tables, 1 RPC, 1 cron job, RLS policies
-- =====================================================

-- 1. Create Archive Tables
-- =====================================================

-- Medical Vault Archive (6 year retention)
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

-- Shipping Audit Archive (3 year retention)
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

-- Error Logs Archive (90 day retention)
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

-- 2. Create Unified Archive RPC
-- =====================================================

CREATE OR REPLACE FUNCTION archive_all_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  archived_count int;
  purged_count int;
BEGIN
  -- 1. Audit Logs → archive (30 days → 6 years) - uses existing function
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
    old_tracking_number, new_tracking_number, old_carrier::text, new_carrier::text,
    old_status::text, new_status::text, change_description, created_at, now()
  FROM shipping_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  DELETE FROM shipping_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';
  
  result := result || jsonb_build_object('shipping_logs_archived', archived_count);

  -- 4. Error Logs → archive (30 days → 90 days)
  -- Exclude system maintenance logs from archival
  INSERT INTO error_logs_archive (
    original_log_id, severity, source, error_message, error_stack,
    user_id, practice_id, details, created_at, archived_at
  )
  SELECT 
    id,
    CASE WHEN action_type LIKE '%critical%' THEN 'critical' ELSE 'error' END,
    entity_type,
    details->>'error_message',
    details->>'error_stack',
    user_id,
    (details->>'practiceId')::uuid,
    details,
    created_at,
    now()
  FROM audit_logs
  WHERE action_type LIKE '%error%'
    AND created_at < now() - INTERVAL '30 days'
    AND (details->>'isSystemMaintenance' IS NULL OR (details->>'isSystemMaintenance')::boolean != true);
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  DELETE FROM audit_logs
  WHERE action_type LIKE '%error%'
    AND created_at < now() - INTERVAL '30 days'
    AND (details->>'isSystemMaintenance' IS NULL OR (details->>'isSystemMaintenance')::boolean != true);
  
  result := result || jsonb_build_object('error_logs_archived', archived_count);

  -- 5. 2FA Logs → purge (90 days retention)
  DELETE FROM two_fa_audit_log
  WHERE created_at < now() - INTERVAL '90 days';
  
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  result := result || jsonb_build_object('two_fa_purged', purged_count);

  -- 6. Video Sessions → purge (30 days)
  DELETE FROM video_sessions
  WHERE created_at < now() - INTERVAL '30 days';
  
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  result := result || jsonb_build_object('video_sessions_purged', purged_count);

  -- 7. Purge old archived data (compliance retention limits)
  DELETE FROM audit_logs_archive
  WHERE created_at < now() - INTERVAL '6 years';
  
  DELETE FROM medical_vault_audit_logs_archive
  WHERE created_at < now() - INTERVAL '6 years';
  
  DELETE FROM shipping_audit_logs_archive
  WHERE created_at < now() - INTERVAL '3 years';
  
  DELETE FROM error_logs_archive
  WHERE created_at < now() - INTERVAL '90 days';

  RETURN result;
END;
$$;

-- 3. Enable RLS on Archive Tables
-- =====================================================

ALTER TABLE medical_vault_audit_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_audit_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs_archive ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins view medical vault archive"
  ON medical_vault_audit_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins view shipping archive"
  ON shipping_audit_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins view error archive"
  ON error_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- 4. Schedule Cron Job (daily at 2:00 AM UTC)
-- =====================================================

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