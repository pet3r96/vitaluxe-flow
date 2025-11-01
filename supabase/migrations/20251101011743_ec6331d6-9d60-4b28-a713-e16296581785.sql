-- Phase 1: Add missing address_verified_at column to patient_accounts
-- This column is referenced in code but missing from the database schema

ALTER TABLE patient_accounts 
ADD COLUMN IF NOT EXISTS address_verified_at timestamp with time zone;

-- Backfill for addresses marked as 'verified'
-- Set to updated_at timestamp for existing verified addresses
UPDATE patient_accounts
SET address_verified_at = updated_at
WHERE address_verification_status = 'verified' 
  AND address_verified_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN patient_accounts.address_verified_at IS 'Timestamp when the address was last verified via Google Address Validation API or manual verification';