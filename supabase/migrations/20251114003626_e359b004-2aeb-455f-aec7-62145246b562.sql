-- Performance indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_patient_appointments_practice_start 
  ON patient_appointments(practice_id, start_time);

CREATE INDEX IF NOT EXISTS idx_patient_appointments_provider_start 
  ON patient_appointments(provider_id, start_time);

CREATE INDEX IF NOT EXISTS idx_patient_appointments_practice_status_start 
  ON patient_appointments(practice_id, status, start_time);

CREATE INDEX IF NOT EXISTS idx_practice_blocked_time_practice_times 
  ON practice_blocked_time(practice_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_providers_practice_active 
  ON providers(practice_id, active);

CREATE INDEX IF NOT EXISTS idx_practice_rooms_practice_active 
  ON practice_rooms(practice_id, active);