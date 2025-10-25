-- Enforce one-time use for password reset and welcome email tokens
-- This migration backfills existing tokens that should be marked as used

-- 1) Ensure used_at exists on temp_password_tokens (should already exist, but safe to check)
ALTER TABLE public.temp_password_tokens 
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- 2) Disable the specific token immediately (both possible tables)
UPDATE public.temp_password_tokens
SET used = true, used_at = NOW()
WHERE token = '3c64fb4e-0844-49d9-b998-5edcf24cf6b3';

UPDATE public.password_reset_tokens
SET used_at = NOW()
WHERE token = '3c64fb4e-0844-49d9-b998-5edcf24cf6b3';

-- 3) Backfill temp_password_tokens: mark as used when password change occurred
UPDATE public.temp_password_tokens t
SET used = true,
    used_at = COALESCE(t.used_at, s.password_last_changed, NOW())
FROM public.user_password_status s
WHERE t.user_id = s.user_id
  AND (t.used = false OR t.used IS NULL)
  AND s.password_last_changed IS NOT NULL
  AND t.used_at IS NULL;

-- 4) Backfill password_reset_tokens: mark used_at when password change occurred
UPDATE public.password_reset_tokens t
SET used_at = COALESCE(t.used_at, s.password_last_changed, NOW())
FROM public.user_password_status s
WHERE t.user_id = s.user_id
  AND t.used_at IS NULL
  AND s.password_last_changed IS NOT NULL;

-- 5) Expire tokens past their expiry (safety measure)
UPDATE public.password_reset_tokens
SET used_at = NOW()
WHERE used_at IS NULL AND expires_at < NOW();

UPDATE public.temp_password_tokens
SET used = true, used_at = NOW()
WHERE (used = false OR used IS NULL) AND expires_at < NOW();

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_token ON public.temp_password_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);