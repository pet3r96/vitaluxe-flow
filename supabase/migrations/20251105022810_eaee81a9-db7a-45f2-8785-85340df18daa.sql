-- Fix the patient status change logging function to use correct column name
CREATE OR REPLACE FUNCTION log_patient_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO audit_logs (
      user_id,
      action_type,        -- Fixed: was 'action', now 'action_type'
      entity_type,
      entity_id,
      details
    )
    VALUES (
      auth.uid(),
      CASE 
        WHEN NEW.status = 'disabled' THEN 'patient_account_disabled'
        WHEN NEW.status = 'active' THEN 'patient_account_enabled'
        ELSE 'patient_account_status_changed'
      END,
      'patient_account',
      NEW.id::text,
      jsonb_build_object(
        'patient_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'changed_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;