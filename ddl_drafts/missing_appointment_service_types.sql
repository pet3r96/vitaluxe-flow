-- ========================================
-- DDL Draft: appointment_service_types
-- Status: DRAFT - DO NOT EXECUTE WITHOUT APPROVAL
-- ========================================

-- PURPOSE:
-- Defines types of services offered (consultations, treatments, etc.)
-- with typical durations for calendar scheduling

-- EVIDENCE FROM CODEBASE:
-- Files using this table:
-- - src/components/calendar/CompleteAppointmentDialog.tsx:88
-- - src/components/calendar/CreateAppointmentDialog.tsx:143
-- - src/components/calendar/RescheduleAppointmentDialog.tsx:67
--
-- Columns inferred from queries:
-- - id (UUID, primary key)
-- - name (TEXT, service type name)
-- - description (TEXT, optional)
-- - typical_duration_minutes (INTEGER, default duration)
-- - active (BOOLEAN, for filtering)
-- - sort_order (INTEGER, for ordering in dropdowns)
-- - created_at, updated_at (timestamps)

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointment_service_types_active 
  ON appointment_service_types(active);
CREATE INDEX IF NOT EXISTS idx_appointment_service_types_sort_order 
  ON appointment_service_types(sort_order);

-- RLS Policies (basic - adjust as needed)
ALTER TABLE appointment_service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active service types"
  ON appointment_service_types FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated users can view all service types"
  ON appointment_service_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert default service types
INSERT INTO appointment_service_types (name, description, typical_duration_minutes, sort_order) VALUES
  ('Consultation', 'Initial patient consultation', 30, 1),
  ('Follow-up', 'Follow-up appointment', 15, 2),
  ('Treatment', 'Treatment session', 60, 3),
  ('Video Call', 'Virtual appointment', 30, 4)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE appointment_service_types IS 'Defines types of services with typical durations for scheduling';
