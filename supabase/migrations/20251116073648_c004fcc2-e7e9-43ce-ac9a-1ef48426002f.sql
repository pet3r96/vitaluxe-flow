-- ========================================
-- PHASE 2: Create Missing Tables (Idempotent)
-- ========================================

-- 1. appointment_service_types
CREATE TABLE IF NOT EXISTS appointment_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  typical_duration_minutes INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_service_types_active 
  ON appointment_service_types(active);
CREATE INDEX IF NOT EXISTS idx_appointment_service_types_sort_order 
  ON appointment_service_types(sort_order);

ALTER TABLE appointment_service_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'appointment_service_types' 
    AND policyname = 'Anyone can view active service types'
  ) THEN
    CREATE POLICY "Anyone can view active service types"
      ON appointment_service_types FOR SELECT
      USING (active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'appointment_service_types' 
    AND policyname = 'Authenticated users can view all service types'
  ) THEN
    CREATE POLICY "Authenticated users can view all service types"
      ON appointment_service_types FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Safe seed data
INSERT INTO appointment_service_types (name, description, typical_duration_minutes, sort_order)
SELECT 'Consultation', 'Initial patient consultation', 30, 1
WHERE NOT EXISTS (SELECT 1 FROM appointment_service_types WHERE name = 'Consultation')
UNION ALL
SELECT 'Follow-up', 'Follow-up appointment', 15, 2
WHERE NOT EXISTS (SELECT 1 FROM appointment_service_types WHERE name = 'Follow-up')
UNION ALL
SELECT 'Treatment', 'Treatment session', 60, 3
WHERE NOT EXISTS (SELECT 1 FROM appointment_service_types WHERE name = 'Treatment')
UNION ALL
SELECT 'Video Call', 'Virtual appointment', 30, 4
WHERE NOT EXISTS (SELECT 1 FROM appointment_service_types WHERE name = 'Video Call');

-- 2. message_threads
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  thread_type TEXT NOT NULL DEFAULT 'support' CHECK (thread_type IN ('support', 'order_issue', 'general')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  resolved_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_created_by 
  ON message_threads(created_by);
CREATE INDEX IF NOT EXISTS idx_message_threads_type 
  ON message_threads(thread_type);
CREATE INDEX IF NOT EXISTS idx_message_threads_resolved 
  ON message_threads(resolved, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_updated 
  ON message_threads(updated_at DESC);

ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'message_threads' 
    AND policyname = 'Creator can view their threads'
  ) THEN
    CREATE POLICY "Creator can view their threads"
      ON message_threads FOR SELECT
      USING (created_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'message_threads' 
    AND policyname = 'Authenticated users can create threads'
  ) THEN
    CREATE POLICY "Authenticated users can create threads"
      ON message_threads FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
  END IF;
END $$;

-- 3. patient_messages
CREATE TABLE IF NOT EXISTS patient_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  parent_message_id UUID NULL REFERENCES patient_messages(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'practice')),
  read_at TIMESTAMP WITH TIME ZONE NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  resolved_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_messages_practice 
  ON patient_messages(practice_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_patient 
  ON patient_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_parent 
  ON patient_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_resolved 
  ON patient_messages(practice_id, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_messages_created 
  ON patient_messages(created_at DESC);

ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_messages' 
    AND policyname = 'Patients can view their messages'
  ) THEN
    CREATE POLICY "Patients can view their messages"
      ON patient_messages FOR SELECT
      USING (patient_id IN (
        SELECT id FROM patient_accounts WHERE user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_messages' 
    AND policyname = 'Practice staff can view their practice messages'
  ) THEN
    CREATE POLICY "Practice staff can view their practice messages"
      ON patient_messages FOR SELECT
      USING (
        practice_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM practice_staff 
          WHERE user_id = auth.uid() 
          AND practice_id = patient_messages.practice_id 
          AND active = true
        )
      );
  END IF;
END $$;

-- 4. internal_messages
CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID NULL REFERENCES patient_accounts(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'general' CHECK (message_type IN ('general', 'task', 'alert', 'note')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_practice 
  ON internal_messages(practice_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_created_by 
  ON internal_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_internal_messages_patient 
  ON internal_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_completed 
  ON internal_messages(practice_id, completed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_messages_priority 
  ON internal_messages(practice_id, priority, created_at DESC);

ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'internal_messages' 
    AND policyname = 'Practice team can view their messages'
  ) THEN
    CREATE POLICY "Practice team can view their messages"
      ON internal_messages FOR SELECT
      USING (
        practice_id = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM practice_staff 
          WHERE user_id = auth.uid() 
          AND practice_id = internal_messages.practice_id 
          AND active = true
        )
      );
  END IF;
END $$;

-- 5. internal_message_recipients
CREATE TABLE IF NOT EXISTS internal_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_internal_message_recipients_message 
  ON internal_message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_internal_message_recipients_recipient 
  ON internal_message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_internal_message_recipients_unread 
  ON internal_message_recipients(recipient_id, read_at) 
  WHERE read_at IS NULL;

ALTER TABLE internal_message_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'internal_message_recipients' 
    AND policyname = 'Recipients can view their assignments'
  ) THEN
    CREATE POLICY "Recipients can view their assignments"
      ON internal_message_recipients FOR SELECT
      USING (recipient_id = auth.uid());
  END IF;
END $$;