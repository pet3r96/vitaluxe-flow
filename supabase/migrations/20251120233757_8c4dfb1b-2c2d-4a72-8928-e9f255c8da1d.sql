-- Add missing verified_at column to sms_verification_attempts table
ALTER TABLE sms_verification_attempts 
ADD COLUMN IF NOT EXISTS verified_at timestamptz;

COMMENT ON COLUMN sms_verification_attempts.verified_at IS 'Timestamp when the verification code was successfully verified';
