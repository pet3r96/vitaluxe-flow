-- Add window_key column for idempotent SMS deduplication
-- window_key is a SHA-256 hash of user_id:time_bucket (10s buckets)
-- This prevents duplicate SMS sends from race conditions without storing PII

ALTER TABLE public.sms_verification_attempts
ADD COLUMN window_key TEXT;

-- Add unique constraint to enforce idempotency
ALTER TABLE public.sms_verification_attempts
ADD CONSTRAINT sms_verification_attempts_window_key_unique UNIQUE (window_key);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_verification_attempts_window_key 
ON public.sms_verification_attempts(window_key) 
WHERE window_key IS NOT NULL;