-- Create RPC function to get patient vault counts for dashboard
CREATE OR REPLACE FUNCTION public.get_patient_vault_counts(p_patient_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'medications_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'medication'
    ),
    'conditions_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'condition'
    ),
    'allergies_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'allergy'
    ),
    'surgeries_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'procedure'
    ),
    'immunizations_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'immunization'
    ),
    'vitals_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'vital_sign'
    ),
    'pharmacies_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'pharmacy'
    ),
    'emergency_contacts_count', (
      SELECT COUNT(*)::INTEGER
      FROM patient_medical_vault
      WHERE patient_account_id = p_patient_account_id
        AND record_type = 'emergency_contact'
    )
  ) INTO result;

  RETURN result;
END;
$$;