-- Phase 1: Create patient_follow_ups table
CREATE TABLE IF NOT EXISTS patient_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  assigned_to UUID,
  
  follow_up_date DATE NOT NULL,
  follow_up_time TIME,
  
  reason TEXT NOT NULL,
  notes TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  
  status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  completion_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_follow_ups_patient ON patient_follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON patient_follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON patient_follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned ON patient_follow_ups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_follow_ups_created_by ON patient_follow_ups(created_by);

-- Updated_at trigger
CREATE TRIGGER set_follow_ups_updated_at BEFORE UPDATE ON patient_follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE patient_follow_ups ENABLE ROW LEVEL SECURITY;

-- Practice staff can view their patients' follow-ups
CREATE POLICY "Staff can view practice follow-ups"
  ON patient_follow_ups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_follow_ups.patient_id
        AND p.practice_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM providers prov
      JOIN patients p ON p.practice_id = prov.practice_id
      WHERE p.id = patient_follow_ups.patient_id
        AND prov.user_id = auth.uid()
    )
  );

-- Staff can create follow-ups for their patients
CREATE POLICY "Staff can create practice follow-ups"
  ON patient_follow_ups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_follow_ups.patient_id
        AND (p.practice_id = auth.uid() OR p.practice_id IN (
          SELECT practice_id FROM providers WHERE user_id = auth.uid()
        ))
    )
  );

-- Staff can update their practice's follow-ups
CREATE POLICY "Staff can update practice follow-ups"
  ON patient_follow_ups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_follow_ups.patient_id
        AND (p.practice_id = auth.uid() OR p.practice_id IN (
          SELECT practice_id FROM providers WHERE user_id = auth.uid()
        ))
    )
  );

-- Admins can do everything
CREATE POLICY "Admins full access to follow-ups"
  ON patient_follow_ups FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Phase 2: Add notification types for follow-ups
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'follow_up_due_today') THEN
    ALTER TYPE notification_type ADD VALUE 'follow_up_due_today';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'follow_up_overdue') THEN
    ALTER TYPE notification_type ADD VALUE 'follow_up_overdue';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'follow_up_upcoming') THEN
    ALTER TYPE notification_type ADD VALUE 'follow_up_upcoming';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'follow_up_assigned') THEN
    ALTER TYPE notification_type ADD VALUE 'follow_up_assigned';
  END IF;
END $$;

-- Function to notify due follow-ups
CREATE OR REPLACE FUNCTION notify_due_follow_ups()
RETURNS void AS $$
DECLARE
  follow_up RECORD;
  notification_type_val TEXT;
  notification_title TEXT;
  notification_message TEXT;
  severity_val TEXT;
BEGIN
  FOR follow_up IN 
    SELECT f.*, 
           CONCAT(p.first_name, ' ', p.last_name) as patient_name
    FROM patient_follow_ups f
    JOIN patients p ON f.patient_id = p.id
    WHERE f.status = 'pending'
      AND f.follow_up_date <= CURRENT_DATE + INTERVAL '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.entity_id = f.id::TEXT
          AND n.entity_type = 'follow_up'
          AND n.created_at::DATE = CURRENT_DATE
      )
  LOOP
    IF follow_up.follow_up_date < CURRENT_DATE THEN
      notification_type_val := 'follow_up_overdue';
      notification_title := 'Overdue Follow-Up';
      notification_message := follow_up.patient_name || ' - Follow-up was due on ' || 
                              TO_CHAR(follow_up.follow_up_date, 'Mon DD, YYYY');
      severity_val := 'error';
    ELSIF follow_up.follow_up_date = CURRENT_DATE THEN
      notification_type_val := 'follow_up_due_today';
      notification_title := 'Follow-Up Due Today';
      notification_message := follow_up.patient_name || ' - ' || follow_up.reason;
      severity_val := 'warning';
    ELSE
      notification_type_val := 'follow_up_upcoming';
      notification_title := 'Upcoming Follow-Up';
      notification_message := follow_up.patient_name || ' - Due ' || 
                              TO_CHAR(follow_up.follow_up_date, 'Mon DD, YYYY');
      severity_val := 'info';
    END IF;
    
    INSERT INTO notifications (
      user_id,
      notification_type,
      severity,
      category,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      COALESCE(follow_up.assigned_to, follow_up.created_by),
      notification_type_val::notification_type,
      severity_val,
      'clinical',
      notification_title,
      notification_message,
      'follow_up',
      follow_up.id::TEXT,
      '/patients/' || follow_up.patient_id || '?tab=follow-ups',
      jsonb_build_object(
        'patient_id', follow_up.patient_id,
        'follow_up_date', follow_up.follow_up_date,
        'priority', follow_up.priority
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify when follow-up is assigned
CREATE OR REPLACE FUNCTION notify_follow_up_assignment()
RETURNS TRIGGER AS $$
DECLARE
  patient_name TEXT;
  creator_name TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    SELECT CONCAT(first_name, ' ', last_name) INTO patient_name FROM patients WHERE id = NEW.patient_id;
    SELECT name INTO creator_name FROM profiles WHERE id = NEW.created_by;
    
    INSERT INTO notifications (
      user_id,
      notification_type,
      severity,
      category,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      NEW.assigned_to,
      'follow_up_assigned',
      'info',
      'clinical',
      'Follow-Up Assigned',
      creator_name || ' assigned you a follow-up for ' || patient_name || ' on ' || 
      TO_CHAR(NEW.follow_up_date, 'Mon DD, YYYY'),
      'follow_up',
      NEW.id::TEXT,
      '/patients/' || NEW.patient_id || '?tab=follow-ups',
      jsonb_build_object(
        'patient_id', NEW.patient_id,
        'follow_up_date', NEW.follow_up_date,
        'reason', NEW.reason
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_follow_up_assignment
AFTER INSERT OR UPDATE ON patient_follow_ups
FOR EACH ROW EXECUTE FUNCTION notify_follow_up_assignment();