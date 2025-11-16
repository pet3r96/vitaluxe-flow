
-- ============================================================================
-- STEP 1: CREATE PATIENTS TABLE ONLY (SIMPLIFIED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id uuid NOT NULL UNIQUE REFERENCES patient_accounts(id) ON DELETE CASCADE,
  practice_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_account ON patients(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patients_practice ON patients(practice_id);
CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);

-- Populate from patient_accounts
INSERT INTO patients (patient_account_id, practice_id, user_id, created_at, updated_at)
SELECT
  pa.id,
  pa.practice_id,
  pa.user_id,
  pa.created_at,
  pa.updated_at
FROM patient_accounts pa
ON CONFLICT (patient_account_id) DO NOTHING;

-- Add trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
