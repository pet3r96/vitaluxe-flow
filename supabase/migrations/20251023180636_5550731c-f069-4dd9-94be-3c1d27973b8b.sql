-- Add address verification metadata columns to pending_practices table
ALTER TABLE pending_practices 
  ADD COLUMN IF NOT EXISTS address_formatted TEXT,
  ADD COLUMN IF NOT EXISTS address_verification_status TEXT,
  ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address_verification_source TEXT;

COMMENT ON COLUMN pending_practices.address_formatted IS 'EasyPost formatted address';
COMMENT ON COLUMN pending_practices.address_verification_status IS 'Verification status: verified, manual, or unverified';
COMMENT ON COLUMN pending_practices.address_verified_at IS 'Timestamp when address was verified';
COMMENT ON COLUMN pending_practices.address_verification_source IS 'Source of verification: easypost, manual_override, etc.';