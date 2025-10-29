-- Fix notification triggers by adding missing severity column

-- Update notify_follow_up_assignment to include severity
CREATE OR REPLACE FUNCTION notify_follow_up_assignment()
RETURNS TRIGGER AS $$
DECLARE
  patient_name TEXT;
  creator_name TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Get patient name from patient_accounts
    SELECT CONCAT(first_name, ' ', last_name) INTO patient_name 
    FROM patient_accounts WHERE id = NEW.patient_id;
    
    SELECT name INTO creator_name FROM profiles WHERE id = NEW.created_by;
    
    INSERT INTO notifications (
      user_id,
      title,
      message,
      notification_type,
      entity_type,
      entity_id,
      severity,
      metadata
    ) VALUES (
      NEW.assigned_to,
      'New Follow-Up Assigned',
      CONCAT('You have been assigned a follow-up for ', COALESCE(patient_name, 'a patient'), ' by ', COALESCE(creator_name, 'someone')),
      'follow_up_assigned',
      'patient_follow_ups',
      NEW.id,
      'info',
      jsonb_build_object(
        'patient_id', NEW.patient_id,
        'follow_up_date', NEW.follow_up_date,
        'priority', NEW.priority,
        'reason', NEW.reason
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update notify_follow_up_scheduled to include severity
CREATE OR REPLACE FUNCTION notify_follow_up_scheduled()
RETURNS TRIGGER AS $$
DECLARE
  patient_name TEXT;
  creator_name TEXT;
BEGIN
  IF NEW.status = 'scheduled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Get patient name from patient_accounts
    SELECT CONCAT(first_name, ' ', last_name) INTO patient_name 
    FROM patient_accounts WHERE id = NEW.patient_id;
    
    SELECT name INTO creator_name FROM profiles WHERE id = NEW.created_by;
    
    -- Notify assigned user if exists
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        notification_type,
        entity_type,
        entity_id,
        severity,
        metadata
      ) VALUES (
        NEW.assigned_to,
        'Follow-Up Scheduled',
        CONCAT('Follow-up scheduled for ', COALESCE(patient_name, 'a patient'), ' on ', TO_CHAR(NEW.follow_up_date, 'Mon DD, YYYY')),
        'follow_up_scheduled',
        'patient_follow_ups',
        NEW.id,
        'info',
        jsonb_build_object(
          'patient_id', NEW.patient_id,
          'follow_up_date', NEW.follow_up_date,
          'priority', NEW.priority
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;