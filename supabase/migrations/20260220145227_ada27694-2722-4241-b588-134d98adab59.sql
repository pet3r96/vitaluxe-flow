
CREATE OR REPLACE FUNCTION public.insert_medical_vault_audit_log(
  p_patient_account_id uuid,
  p_practice_id uuid,
  p_action_type text,
  p_record_id uuid DEFAULT NULL,
  p_changed_by uuid DEFAULT NULL,
  p_performed_by_user_id uuid DEFAULT NULL,
  p_change_summary text DEFAULT NULL,
  p_previous_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO medical_vault_audit_logs (
    patient_account_id, practice_id, action_type,
    record_id, changed_by, performed_by_user_id,
    change_summary, previous_values, new_values
  ) VALUES (
    p_patient_account_id, p_practice_id, p_action_type,
    p_record_id, p_changed_by, p_performed_by_user_id,
    p_change_summary, p_previous_values, p_new_values
  );
$$;
