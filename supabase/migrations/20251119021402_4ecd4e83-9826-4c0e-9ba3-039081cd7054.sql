-- PHASE 2: WEEK 2+4 SIMPLIFIED RLS + TOKEN SECURITY

-- Service role policies for all critical tables
DO $$ BEGIN CREATE POLICY active_impersonation_sessions_svc ON active_impersonation_sessions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admin_alerts_svc ON admin_alerts FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cart_svc ON cart FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cart_lines_svc ON cart_lines FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY orders_svc ON orders FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY order_lines_svc ON order_lines FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_accounts_svc ON patient_accounts FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pharmacies_svc ON pharmacies FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY profiles_svc ON profiles FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY providers_svc ON providers FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY user_sessions_svc ON user_sessions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY user_2fa_settings_svc ON user_2fa_settings FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Certificate rotation table (without generated column)
CREATE TABLE IF NOT EXISTS cert_rotation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_name TEXT NOT NULL UNIQUE,
  last_rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotation_interval_days INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO cert_rotation_schedule (cert_name, rotation_interval_days) VALUES ('AGORA_APP_CERT', 90) ON CONFLICT DO NOTHING;
ALTER TABLE cert_rotation_schedule ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY cert_rotation_admin ON cert_rotation_schedule FOR ALL TO authenticated USING (is_admin(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cert_rotation_svc ON cert_rotation_schedule FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;