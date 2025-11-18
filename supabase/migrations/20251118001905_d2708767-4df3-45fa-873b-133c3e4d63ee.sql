-- Create missing audit_logs_archive table
CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id uuid PRIMARY KEY,
  user_id uuid,
  user_email text,
  user_role text,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL,
  correlation_id text,
  archived_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_archive_created ON audit_logs_archive(created_at);
CREATE INDEX idx_audit_archive_user ON audit_logs_archive(user_id);
CREATE INDEX idx_audit_archive_action ON audit_logs_archive(action_type);
CREATE INDEX idx_audit_archive_correlation ON audit_logs_archive(correlation_id);

-- Enable RLS
ALTER TABLE audit_logs_archive ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins view audit archive"
  ON audit_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );