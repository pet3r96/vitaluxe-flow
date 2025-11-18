-- Fix archive_all_logs() to match actual table schemas
CREATE OR REPLACE FUNCTION archive_all_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  archived_count int;
  purged_count int;
BEGIN
  -- 1. Audit Logs → archive (30 days → 6 years)
  -- Uses existing archive_old_audit_logs() function
  PERFORM archive_old_audit_logs();
  result := result || jsonb_build_object('audit_logs_archived', true);

  -- 2. Medical Vault Logs → archive (30 days → 6 years)
  -- Match actual medical_vault_audit_logs schema: id, patient_account_id, action_type, record_id, changed_by, change_summary, created_at
  INSERT INTO medical_vault_audit_logs_archive (
    id, original_log_id, patient_account_id, action_type, 
    entity_id, changed_by_user_id, change_summary, created_at, archived_at
  )
  SELECT 
    gen_random_uuid(), id, patient_account_id, action_type,
    record_id, changed_by, change_summary, created_at, now()
  FROM medical_vault_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  DELETE FROM medical_vault_audit_logs
  WHERE created_at < now() - INTERVAL '30 days';

  result := result || jsonb_build_object('medical_vault_archived', archived_count);

  -- 3. Error Logs → archive (30 days → 90 days)
  -- Extract error logs from audit_logs
  INSERT INTO error_logs_archive (
    id, original_log_id, severity, source, error_message, error_stack,
    user_id, practice_id, details, created_at, archived_at
  )
  SELECT 
    gen_random_uuid(), id,
    CASE WHEN action_type LIKE '%critical%' THEN 'critical' ELSE 'error' END,
    entity_type,
    details->>'error_message',
    details->>'error_stack',
    user_id,
    CASE 
      WHEN details->>'practiceId' ~ '^[0-9a-fA-F-]{36}$'
        THEN (details->>'practiceId')::uuid
      ELSE NULL
    END,
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

  -- 4. 2FA Logs → purge (90 days retention)
  DELETE FROM two_fa_audit_log
  WHERE created_at < now() - INTERVAL '90 days';

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  result := result || jsonb_build_object('two_fa_purged', purged_count);

  -- 5. Video Sessions → purge (30 days retention) - if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'video_sessions'
  ) THEN
    DELETE FROM video_sessions
    WHERE created_at < now() - INTERVAL '30 days';

    GET DIAGNOSTICS purged_count = ROW_COUNT;
    result := result || jsonb_build_object('video_sessions_purged', purged_count);
  END IF;

  -- 6. Purge old archived data (compliance retention limits)
  DELETE FROM audit_logs_archive
  WHERE created_at < now() - INTERVAL '6 years';

  DELETE FROM medical_vault_audit_logs_archive
  WHERE created_at < now() - INTERVAL '6 years';

  DELETE FROM error_logs_archive
  WHERE created_at < now() - INTERVAL '90 days';

  RETURN result;
END;
$$;