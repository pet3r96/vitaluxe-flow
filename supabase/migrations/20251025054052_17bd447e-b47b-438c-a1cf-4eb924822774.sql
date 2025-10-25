-- Add used_at column to temp_password_tokens for consistency
ALTER TABLE temp_password_tokens 
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;

-- Backfill: Mark ALL existing tokens as used to disable old welcome email links
UPDATE temp_password_tokens
SET 
  used = true,
  used_at = NOW()
WHERE used = false;

-- Add comment for documentation
COMMENT ON COLUMN temp_password_tokens.used_at IS 'Timestamp when the token was used. Ensures one-time use of welcome email links.';