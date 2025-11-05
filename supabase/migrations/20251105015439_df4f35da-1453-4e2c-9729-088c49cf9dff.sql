-- Add audit logging trigger for patient account status changes
CREATE OR REPLACE FUNCTION log_patient_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
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

-- Create trigger for patient account status changes
DROP TRIGGER IF EXISTS patient_status_change_trigger ON patient_accounts;
CREATE TRIGGER patient_status_change_trigger
  AFTER UPDATE ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION log_patient_status_change();

-- Add RLS policy to allow practice owners and staff to update patient account status
CREATE POLICY "Practice owners and staff can update patient account status"
  ON patient_accounts
  FOR UPDATE
  USING (
    practice_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM practice_staff ps
      WHERE ps.practice_id = patient_accounts.practice_id
      AND ps.user_id = auth.uid()
      AND ps.active = true
    )
  )
  WITH CHECK (
    practice_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM practice_staff ps
      WHERE ps.practice_id = patient_accounts.practice_id
      AND ps.user_id = auth.uid()
      AND ps.active = true
    )
  );