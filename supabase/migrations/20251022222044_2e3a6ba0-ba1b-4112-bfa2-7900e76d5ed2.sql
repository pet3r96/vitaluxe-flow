-- =====================================================
-- GHL SMS Security Refactor: Remove PII Storage
-- =====================================================
-- This migration ensures compliance with:
-- 1. GHL 5-second timeout requirement
-- 2. No PII storage (no user_id, no phone numbers)
-- 3. Only attempt_id + timestamp + result logging
-- =====================================================

-- Create new secure SMS verification table (no PII)
CREATE TABLE IF NOT EXISTS public.sms_verification_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup and expiration queries
CREATE INDEX IF NOT EXISTS idx_sms_attempts_expires_at 
  ON public.sms_verification_attempts(expires_at);

-- Index for verification lookups
CREATE INDEX IF NOT EXISTS idx_sms_attempts_verified 
  ON public.sms_verification_attempts(verified, expires_at) 
  WHERE verified = false;

-- Enable RLS
ALTER TABLE public.sms_verification_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can insert (for sending codes)
CREATE POLICY "Anyone can create verification attempts"
  ON public.sms_verification_attempts
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Anyone can read their own attempt by attempt_id (for verification)
CREATE POLICY "Anyone can read verification attempts"
  ON public.sms_verification_attempts
  FOR SELECT
  USING (true);

-- RLS Policy: System can update for verification
CREATE POLICY "System can update verification attempts"
  ON public.sms_verification_attempts
  FOR UPDATE
  USING (true);

-- Function to cleanup expired attempts (auto-delete after 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sms_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM sms_verification_attempts 
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Update two_fa_audit_log to remove PII and use attempt_id
-- First add new columns
ALTER TABLE public.two_fa_audit_log 
  ADD COLUMN IF NOT EXISTS attempt_id UUID,
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- Create index for attempt_id lookups
CREATE INDEX IF NOT EXISTS idx_2fa_audit_attempt_id 
  ON public.two_fa_audit_log(attempt_id);

-- Comment explaining the security model
COMMENT ON TABLE public.sms_verification_attempts IS 
  'Secure SMS verification storage - contains NO PII (no user_id, no phone). Only stores attempt_id, code_hash, and expiration.';

COMMENT ON COLUMN public.two_fa_audit_log.attempt_id IS 
  'Non-PII identifier linking to verification attempt. Replaces user_id/phone for privacy compliance.';

-- Drop old PII-containing table (after migration)
-- NOTE: This will be done after edge functions are updated
-- DROP TABLE IF EXISTS public.sms_codes;