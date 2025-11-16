-- Add missing columns to patient_follow_ups (keep existing columns)
ALTER TABLE patient_follow_ups
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_time TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES profiles(id);

-- Backfill from existing fields so UI has data
UPDATE patient_follow_ups
  SET follow_up_date = COALESCE(follow_up_date, due_date),
      reason         = COALESCE(reason, subject)
WHERE follow_up_date IS NULL OR reason IS NULL;

-- Indices for query performance
CREATE INDEX IF NOT EXISTS pfu_patient_date_idx ON patient_follow_ups (patient_id, follow_up_date);
CREATE INDEX IF NOT EXISTS pfu_status_idx ON patient_follow_ups (status);
CREATE INDEX IF NOT EXISTS pfu_assigned_to_idx ON patient_follow_ups (assigned_to);
CREATE INDEX IF NOT EXISTS pfu_created_by_idx ON patient_follow_ups (created_by);