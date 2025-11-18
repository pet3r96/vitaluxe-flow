-- FIX #1: Medical Vault Archive Schema Correction
-- Drop 5 unnecessary columns that don't exist in source table
ALTER TABLE medical_vault_audit_logs_archive 
  DROP COLUMN IF EXISTS entity_type,
  DROP COLUMN IF EXISTS entity_name,
  DROP COLUMN IF EXISTS changed_by_role,
  DROP COLUMN IF EXISTS old_data,
  DROP COLUMN IF EXISTS new_data;

-- FIX #2: Drop Orphaned Shipping Archive Table
-- No source table exists, so this archive is orphaned
DROP TABLE IF EXISTS shipping_audit_logs_archive CASCADE;

-- FIX #3 & #4: Update archive_all_logs() with 90-day thresholds and transaction safety
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
  -- Transaction wrapper for atomicity
  BEGIN
    -- 1. Archive old audit logs (90 days)
    WITH moved_logs AS (
      INSERT INTO audit_logs_archive
      SELECT 
        id, user_id, user_email, user_role, action_type,
        entity_type, entity_id, details, ip_address, user_agent,
        created_at, correlation_id, now() as archived_at
      FROM audit_logs
      WHERE created_at < now() - INTERVAL '90 days'
        AND action_type NOT LIKE '%system_maintenance%'
      RETURNING id
    )
    SELECT COUNT(*) INTO archived_count FROM moved_logs;
    
    DELETE FROM audit_logs
    WHERE created_at < now() - INTERVAL '90 days'
      AND action_type NOT LIKE '%system_maintenance%';
    
    result := result || jsonb_build_object('audit_logs_archived', archived_count);
    
    -- 2. Archive old medical vault logs (90 days - FIXED)
    WITH moved_medical AS (
      INSERT INTO medical_vault_audit_logs_archive
      SELECT 
        gen_random_uuid() as id,
        id as original_log_id,
        patient_account_id,
        action_type,
        record_id as entity_id,
        changed_by as changed_by_user_id,
        change_summary,
        created_at,
        now() as archived_at
      FROM medical_vault_audit_logs
      WHERE created_at < now() - INTERVAL '90 days'
      RETURNING id
    )
    SELECT COUNT(*) INTO archived_count FROM moved_medical;
    
    DELETE FROM medical_vault_audit_logs
    WHERE created_at < now() - INTERVAL '90 days';
    
    result := result || jsonb_build_object('medical_vault_logs_archived', archived_count);
    
    -- 3. Archive error logs from audit_logs (90 days - FIXED)
    WITH moved_errors AS (
      INSERT INTO error_logs_archive
      SELECT 
        gen_random_uuid() as id,
        id as original_log_id,
        user_id,
        'audit_logs' as source,
        details->>'error_message' as error_message,
        details->>'error_stack' as error_stack,
        'error' as severity,
        details,
        NULL as practice_id,
        created_at,
        now() as archived_at
      FROM audit_logs
      WHERE action_type LIKE '%error%'
        AND created_at < now() - INTERVAL '90 days'
        AND action_type NOT LIKE '%system_maintenance%'
      RETURNING id
    )
    SELECT COUNT(*) INTO archived_count FROM moved_errors;
    
    DELETE FROM audit_logs
    WHERE action_type LIKE '%error%'
      AND created_at < now() - INTERVAL '90 days'
      AND action_type NOT LIKE '%system_maintenance%';
    
    result := result || jsonb_build_object('error_logs_archived', archived_count);
    
    -- 4. Archive old 2FA logs (90 days)
    DELETE FROM two_fa_audit_log
    WHERE created_at < now() - INTERVAL '90 days';
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    result := result || jsonb_build_object('two_fa_logs_purged', purged_count);
    
    -- 5. Purge old video sessions (30 days - keep as-is)
    DELETE FROM video_sessions
    WHERE created_at < now() - INTERVAL '30 days'
      AND status IN ('ended', 'cancelled');
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    result := result || jsonb_build_object('video_sessions_purged', purged_count);
    
    -- 6. Purge ancient archived logs (6 years HIPAA retention)
    DELETE FROM audit_logs_archive
    WHERE created_at < now() - INTERVAL '6 years';
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    result := result || jsonb_build_object('ancient_audit_logs_purged', purged_count);
    
    DELETE FROM medical_vault_audit_logs_archive
    WHERE created_at < now() - INTERVAL '6 years';
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    result := result || jsonb_build_object('ancient_medical_logs_purged', purged_count);
    
    DELETE FROM error_logs_archive
    WHERE created_at < now() - INTERVAL '90 days';
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    result := result || jsonb_build_object('ancient_error_logs_purged', purged_count);
    
    -- Add success flag and timestamp
    result := result || jsonb_build_object(
      'success', true,
      'executed_at', now()
    );
    
    RETURN result;

  EXCEPTION WHEN OTHERS THEN
    -- Automatic rollback on any error
    RAISE EXCEPTION 'archive_all_logs failed: %', SQLERRM;
  END;
END;
$$;