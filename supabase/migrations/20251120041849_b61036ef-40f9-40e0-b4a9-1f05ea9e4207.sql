-- ============================================
-- Create password_reset_tokens table
-- ============================================
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all password reset tokens"
  ON password_reset_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin'::app_role, 'super_admin'::app_role)
    )
  );

CREATE POLICY "Service role full access"
  ON password_reset_tokens FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE password_reset_tokens IS 'Stores tokens for user-initiated password reset requests (forgot password flow)';

-- ============================================
-- Create temp_password_tokens table
-- ============================================
CREATE TABLE IF NOT EXISTS public.temp_password_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_token ON temp_password_tokens(token) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_user_id ON temp_password_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_expires_at ON temp_password_tokens(expires_at) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_used_at ON temp_password_tokens(used_at);

ALTER TABLE temp_password_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tokens"
  ON temp_password_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access temp tokens"
  ON temp_password_tokens FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE temp_password_tokens IS 'Stores temporary password setup tokens sent via welcome emails when admins create accounts';