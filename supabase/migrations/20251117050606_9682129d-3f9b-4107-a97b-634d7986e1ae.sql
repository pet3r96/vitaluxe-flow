-- ================================================================
-- BATCH 7 + 8: MEDIUM-RISK RLS HARDENING + AUDIT LOGGING
-- ================================================================

-- ===========================
-- PART A: MEDIUM-RISK TABLES
-- ===========================

-- 1) PRACTICE_ROOMS
-- Practice owners and staff view their practice rooms
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'practice_rooms' 
    AND policyname = 'staff_view_practice_rooms'
  ) THEN
    CREATE POLICY "staff_view_practice_rooms"
      ON practice_rooms FOR SELECT
      TO authenticated
      USING (
        practice_id IN (
          SELECT practice_id 
          FROM practice_staff 
          WHERE user_id = auth.uid()
            AND active = true
        )
      );
  END IF;
END $$;

-- 2) API_RATE_LIMITS_CONFIG
-- Admins read rate limit config
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_rate_limits_config' 
    AND policyname = 'admins_read_rate_limit_config'
  ) THEN
    CREATE POLICY "admins_read_rate_limit_config"
      ON api_rate_limits_config FOR SELECT
      TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;
END $$;

-- 3) PHARMACY_API_CREDENTIALS
-- Admins read pharmacy API credentials
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pharmacy_api_credentials' 
    AND policyname = 'admins_read_pharmacy_api_credentials'
  ) THEN
    CREATE POLICY "admins_read_pharmacy_api_credentials"
      ON pharmacy_api_credentials FOR SELECT
      TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;
END $$;

-- 4) VIDEO_USAGE_PRICING
-- Practice staff can view pricing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'video_usage_pricing' 
    AND policyname = 'staff_view_pricing'
  ) THEN
    CREATE POLICY "staff_view_pricing"
      ON video_usage_pricing FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 
          FROM practice_staff ps 
          WHERE ps.user_id = auth.uid()
            AND ps.active = true
        )
      );
  END IF;
END $$;

-- ===========================
-- PART B: AUDIT LOGGING TABLES
-- ===========================

-- SECURITY_EVENTS (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'security_events') THEN
    -- Admins view all security events
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'security_events' 
      AND policyname = 'admins_view_all_security_events'
    ) THEN
      EXECUTE 'CREATE POLICY "admins_view_all_security_events"
        ON security_events FOR SELECT
        TO authenticated
        USING (has_role(auth.uid(), ''admin''::app_role))';
    END IF;
    
    -- Users view their own security events
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'security_events' 
      AND policyname = 'users_view_own_security_events'
    ) THEN
      EXECUTE 'CREATE POLICY "users_view_own_security_events"
        ON security_events FOR SELECT
        TO authenticated
        USING (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- AUDIT_LOGS
-- Users view their own audit logs or admins view all
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' 
    AND policyname = 'users_view_own_audit_logs'
  ) THEN
    CREATE POLICY "users_view_own_audit_logs"
      ON audit_logs FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;
END $$;

-- ACTIVITY_LOGS (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'activity_logs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'activity_logs' 
      AND policyname = 'users_view_own_activity_logs'
    ) THEN
      EXECUTE 'CREATE POLICY "users_view_own_activity_logs"
        ON activity_logs FOR SELECT
        TO authenticated
        USING (
          user_id = auth.uid()
          OR has_role(auth.uid(), ''admin''::app_role)
        )';
    END IF;
  END IF;
END $$;