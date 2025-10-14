-- Create security_events table
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all security events"
ON security_events FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert security events"
ON security_events FOR INSERT
WITH CHECK (true);

-- Create failed_login_attempts table
CREATE TABLE failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_failed_logins_email ON failed_login_attempts(email);
CREATE INDEX idx_failed_logins_ip ON failed_login_attempts(ip_address);
CREATE INDEX idx_failed_logins_last_attempt ON failed_login_attempts(last_attempt_at DESC);

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view failed login attempts"
ON failed_login_attempts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage failed login attempts"
ON failed_login_attempts FOR ALL
WITH CHECK (true);

-- Create alert_rules table
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  time_window_minutes INTEGER NOT NULL DEFAULT 10,
  severity TEXT NOT NULL DEFAULT 'medium',
  enabled BOOLEAN NOT NULL DEFAULT true,
  notification_channels JSONB DEFAULT '[]',
  recipients JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_event_type ON alert_rules(event_type);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alert rules"
ON alert_rules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  notification_sent BOOLEAN DEFAULT false,
  notification_error TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_rule_id ON alerts(rule_id);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_notification_sent ON alerts(notification_sent);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alerts"
ON alerts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert alerts"
ON alerts FOR INSERT
WITH CHECK (true);

-- Create audit_logs_archive table
CREATE TABLE audit_logs_archive (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_archive_action_type ON audit_logs_archive(action_type);
CREATE INDEX idx_audit_archive_user_id ON audit_logs_archive(user_id);
CREATE INDEX idx_audit_archive_created_at ON audit_logs_archive(created_at DESC);
CREATE INDEX idx_audit_archive_archived_at ON audit_logs_archive(archived_at DESC);

ALTER TABLE audit_logs_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archived logs"
ON audit_logs_archive FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert archived logs"
ON audit_logs_archive FOR INSERT
WITH CHECK (true);

-- Create archive function
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move logs older than 90 days to archive
  WITH moved_logs AS (
    INSERT INTO audit_logs_archive
    SELECT 
      id, user_id, user_email, user_role, action_type,
      entity_type, entity_id, details, ip_address, user_agent,
      created_at, now() as archived_at
    FROM audit_logs
    WHERE created_at < now() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO archived_count FROM moved_logs;
  
  -- Delete archived logs from main table
  DELETE FROM audit_logs
  WHERE created_at < now() - INTERVAL '90 days';
  
  -- Delete logs older than 6 years from archive (HIPAA retention)
  DELETE FROM audit_logs_archive
  WHERE created_at < now() - INTERVAL '6 years';
  
  RETURN archived_count;
END;
$$;