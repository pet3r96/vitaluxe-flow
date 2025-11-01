-- Add rep_commission_percentage column to practice_subscriptions
ALTER TABLE practice_subscriptions 
ADD COLUMN IF NOT EXISTS rep_commission_percentage numeric DEFAULT 0 CHECK (rep_commission_percentage >= 0 AND rep_commission_percentage <= 100);

-- Add a comment explaining the column
COMMENT ON COLUMN practice_subscriptions.rep_commission_percentage IS 'Commission percentage for the linked sales rep (0-100)';