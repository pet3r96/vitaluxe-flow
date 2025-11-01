-- Add 'used' column to password_reset_tokens table to match temp_password_tokens
-- This ensures consistent one-time use enforcement across all password reset flows
ALTER TABLE password_reset_tokens 
ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE;

-- Add index for better performance when checking used tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used 
ON password_reset_tokens(used);