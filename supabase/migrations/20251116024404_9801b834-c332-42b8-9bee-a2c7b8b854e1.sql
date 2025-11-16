-- ============================================================================
-- TEST: PHASES A & B ONLY (Structure changes without data migration)
-- ============================================================================

-- PHASE A: FIX system_settings SCHEMA
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS setting_type text,
  ADD COLUMN IF NOT EXISTS practice_id uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_settings_type ON system_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_settings_practice ON system_settings(practice_id);

-- PHASE B: CREATE/ALTER STRUCTURES
-- B1: Create prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id uuid NOT NULL REFERENCES patient_accounts(id) ON DELETE RESTRICT,
  provider_id uuid REFERENCES providers(id) ON DELETE RESTRICT,
  practice_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  medication_name text NOT NULL,
  dosage text,
  sig text,
  quantity integer,
  refills_allowed integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_rx_provider ON prescriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_rx_practice ON prescriptions(practice_id);

-- B2: ALTER patient_medical_vault
ALTER TABLE patient_medical_vault
  ADD COLUMN IF NOT EXISTS patient_account_id uuid REFERENCES patient_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS record_data jsonb,
  ADD COLUMN IF NOT EXISTS primary_value text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

UPDATE patient_medical_vault
SET patient_account_id = patient_id
WHERE patient_account_id IS NULL AND patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_patient_account ON patient_medical_vault(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_vault_primary ON patient_medical_vault(record_type, primary_value);
CREATE INDEX IF NOT EXISTS idx_vault_record_data_gin ON patient_medical_vault USING GIN (record_data);

-- B3: ALTER user_sessions
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS impersonated_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_user_sessions_type ON user_sessions(session_type);

-- B4: ALTER messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

-- B5: ALTER notification_preferences
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS channels jsonb DEFAULT '{"email":true,"sms":true,"push":true}'::jsonb;