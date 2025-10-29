-- Add indexes for appointment availability queries to improve performance

-- Index for practice calendar hours lookups by practice and day
CREATE INDEX IF NOT EXISTS idx_practice_hours_lookup 
ON practice_calendar_hours(practice_id, day_of_week);

-- Index for blocked time range checks
CREATE INDEX IF NOT EXISTS idx_blocked_time_range 
ON practice_blocked_time(practice_id, start_time, end_time);

-- Index for appointment conflict checks
CREATE INDEX IF NOT EXISTS idx_appointments_conflict_check 
ON patient_appointments(practice_id, start_time, end_time) 
WHERE status NOT IN ('cancelled', 'no_show');