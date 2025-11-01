-- Add new columns to practice_subscriptions for better subscription management
ALTER TABLE practice_subscriptions 
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_attempt_at TIMESTAMP WITH TIME ZONE;

-- Create table to track trial payment reminders sent to users
CREATE TABLE IF NOT EXISTS trial_payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES practice_subscriptions(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('day_5', 'day_6', 'trial_ending', 'suspended')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(subscription_id, reminder_type)
);

-- Enable RLS on trial_payment_reminders
ALTER TABLE trial_payment_reminders ENABLE ROW LEVEL SECURITY;

-- Admins can view all reminders
CREATE POLICY "Admins can view all trial reminders"
ON trial_payment_reminders FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert reminders
CREATE POLICY "System can insert trial reminders"
ON trial_payment_reminders FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_trial_reminders_subscription_id ON trial_payment_reminders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends_at ON practice_subscriptions(trial_ends_at) WHERE status = 'trial';
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON practice_subscriptions(current_period_end) WHERE status = 'active';