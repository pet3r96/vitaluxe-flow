-- Add column to track when patient permanently dismisses intake reminder
ALTER TABLE public.patient_accounts 
ADD COLUMN IF NOT EXISTS intake_reminder_dismissed_at TIMESTAMPTZ NULL;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_patient_accounts_intake_reminder 
ON public.patient_accounts(intake_reminder_dismissed_at) 
WHERE intake_reminder_dismissed_at IS NULL;

COMMENT ON COLUMN public.patient_accounts.intake_reminder_dismissed_at IS 'Timestamp when patient clicked "Don''t ask me again" for intake reminder. NULL means they want reminders, non-NULL means permanently dismissed.';