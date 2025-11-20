-- Fix get_patient_vault_grouped RPC to use correct record_type values
-- This fixes vitals ('vital' → 'vital_sign') and surgeries ('surgery' → 'procedure')

CREATE OR REPLACE FUNCTION get_patient_vault_grouped(p_patient_account_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'medications', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'medication'
        ORDER BY created_at DESC
        LIMIT 50
      ) pmv
    ),
    'conditions', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'condition'
        ORDER BY created_at DESC
        LIMIT 50
      ) pmv
    ),
    'allergies', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'allergy'
        ORDER BY created_at DESC
        LIMIT 50
      ) pmv
    ),
    'vitals', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'vital_sign'
        ORDER BY created_at DESC
        LIMIT 20
      ) pmv
    ),
    'immunizations', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'immunization'
        ORDER BY created_at DESC
        LIMIT 20
      ) pmv
    ),
    'surgeries', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'procedure'
        ORDER BY created_at DESC
        LIMIT 20
      ) pmv
    ),
    'pharmacies', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'pharmacy'
        ORDER BY created_at DESC
        LIMIT 10
      ) pmv
    ),
    'emergency_contacts', (
      SELECT COALESCE(jsonb_agg(row_to_json(pmv.*) ORDER BY pmv.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM patient_medical_vault
        WHERE patient_account_id = p_patient_account_id
          AND record_type = 'emergency_contact'
        ORDER BY created_at DESC
        LIMIT 5
      ) pmv
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;