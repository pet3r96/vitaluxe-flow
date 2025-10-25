-- Clean up old 2FA system tables and types
-- This removes the deprecated two_fa_verification_codes table that has been replaced by sms_verification_attempts

-- Drop the old 2FA verification codes table
DROP TABLE IF EXISTS public.two_fa_verification_codes CASCADE;

-- Drop the verification code type enum if it exists and is not used elsewhere
DROP TYPE IF EXISTS public.verification_code_type CASCADE;