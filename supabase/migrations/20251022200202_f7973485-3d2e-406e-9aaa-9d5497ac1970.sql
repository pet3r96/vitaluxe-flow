-- Create sms_codes table for GHL SMS verification
CREATE TABLE sms_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_sms_codes_user_id ON sms_codes(user_id);
CREATE INDEX idx_sms_codes_phone ON sms_codes(phone);
CREATE INDEX idx_sms_codes_verified ON sms_codes(verified);
CREATE INDEX idx_sms_codes_expires_at ON sms_codes(expires_at);

-- RLS Policies
ALTER TABLE sms_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SMS codes"
  ON sms_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert SMS codes"
  ON sms_codes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update SMS codes"
  ON sms_codes FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view all SMS codes"
  ON sms_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
  );

-- Auto-cleanup function for expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_sms_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM sms_codes 
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Extend user_2fa_settings table
ALTER TABLE user_2fa_settings
ADD COLUMN IF NOT EXISTS ghl_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_ghl_verification TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ghl_phone_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_2fa_settings_ghl_enabled ON user_2fa_settings(ghl_enabled);
CREATE INDEX IF NOT EXISTS idx_user_2fa_settings_last_ghl_verification ON user_2fa_settings(last_ghl_verification);

-- Create audit log for 2FA events (HIPAA compliance)
CREATE TABLE two_fa_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  phone TEXT NOT NULL,
  code_verified BOOLEAN,
  attempt_count INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_two_fa_audit_log_user_id ON two_fa_audit_log(user_id);
CREATE INDEX idx_two_fa_audit_log_event_type ON two_fa_audit_log(event_type);
CREATE INDEX idx_two_fa_audit_log_created_at ON two_fa_audit_log(created_at);

ALTER TABLE two_fa_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all 2FA audit logs"
  ON two_fa_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
  );

CREATE POLICY "System can insert 2FA audit logs"
  ON two_fa_audit_log FOR INSERT
  WITH CHECK (true);