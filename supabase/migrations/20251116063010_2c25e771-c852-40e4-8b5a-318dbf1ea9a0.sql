-- Create impersonation_logs table
CREATE TABLE IF NOT EXISTS impersonation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  impersonator_id uuid NOT NULL,
  impersonator_email text NOT NULL,
  target_user_id uuid,
  target_user_email text NOT NULL,
  target_user_name text NOT NULL,
  target_role text NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create active_impersonation_sessions table
CREATE TABLE IF NOT EXISTS active_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL UNIQUE,
  impersonated_role text NOT NULL,
  impersonated_user_id uuid,
  impersonated_user_name text,
  impersonation_log_id uuid REFERENCES impersonation_logs(id) ON DELETE CASCADE,
  last_activity timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_impersonator ON impersonation_logs(impersonator_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target ON impersonation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_admin ON active_impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_impersonation_sessions(expires_at);

-- Enable RLS
ALTER TABLE impersonation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for impersonation_logs
-- Super admins can view all logs
CREATE POLICY "Super admins can view all impersonation logs"
  ON impersonation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Super admins can insert logs
CREATE POLICY "Super admins can insert impersonation logs"
  ON impersonation_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Super admins can update logs (for end_time)
CREATE POLICY "Super admins can update impersonation logs"
  ON impersonation_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- RLS Policies for active_impersonation_sessions
-- Super admins can view their own sessions
CREATE POLICY "Super admins can view their own sessions"
  ON active_impersonation_sessions FOR SELECT
  TO authenticated
  USING (
    admin_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Super admins can insert their own sessions
CREATE POLICY "Super admins can insert their own sessions"
  ON active_impersonation_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Super admins can update their own sessions
CREATE POLICY "Super admins can update their own sessions"
  ON active_impersonation_sessions FOR UPDATE
  TO authenticated
  USING (
    admin_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Super admins can delete their own sessions
CREATE POLICY "Super admins can delete their own sessions"
  ON active_impersonation_sessions FOR DELETE
  TO authenticated
  USING (
    admin_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );