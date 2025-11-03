-- Add access_count column to track number of times a share link has been accessed
-- This allows for 2 attempts (initial view + 1 refresh) before marking as fully used

ALTER TABLE medical_vault_share_links 
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Update existing records: if already used, set count to 2
UPDATE medical_vault_share_links 
SET access_count = CASE 
  WHEN used_at IS NOT NULL THEN 2
  ELSE 0 
END;