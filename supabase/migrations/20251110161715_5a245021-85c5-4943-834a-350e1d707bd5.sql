-- Add paid terms acceptance tracking to practice_subscriptions
ALTER TABLE practice_subscriptions
ADD COLUMN IF NOT EXISTS paid_terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_terms_version TEXT;

-- Add comment for clarity
COMMENT ON COLUMN practice_subscriptions.paid_terms_accepted_at IS 'Timestamp when user accepted paid subscription terms';
COMMENT ON COLUMN practice_subscriptions.paid_terms_version IS 'Version of terms accepted for paid subscription';