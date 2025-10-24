-- Add status column to practice_payment_methods to track declined/removed cards
ALTER TABLE practice_payment_methods 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'declined', 'expired', 'removed'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_status ON practice_payment_methods(status);

-- Update existing records to have 'active' status
UPDATE practice_payment_methods 
SET status = 'active' 
WHERE status IS NULL;