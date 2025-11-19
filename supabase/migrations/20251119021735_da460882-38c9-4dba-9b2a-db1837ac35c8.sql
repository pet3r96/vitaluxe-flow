-- =====================================================
-- PHASE 2 WEEK 4: SMS Verification Attempts Table
-- =====================================================
-- Create table to track SMS verification attempts for rate limiting

CREATE TABLE IF NOT EXISTS sms_verification_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  window_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE sms_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY sms_verification_attempts_svc ON sms_verification_attempts
  FOR ALL TO service_role USING (true);

-- Users can view their own attempts
CREATE POLICY sms_verification_attempts_user_view ON sms_verification_attempts
  FOR SELECT USING (user_id = auth.uid());

-- Index for rate limiting queries
CREATE INDEX idx_sms_verif_attempts_user_created ON sms_verification_attempts(user_id, created_at DESC);
CREATE INDEX idx_sms_verif_attempts_created ON sms_verification_attempts(created_at DESC);