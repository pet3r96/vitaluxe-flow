-- ============================================================================
-- Fix CHECK Constraint on patient_medical_vault
-- Extend to support all 12 record types needed for consolidation
-- ============================================================================

-- Drop old constraint
ALTER TABLE patient_medical_vault
DROP CONSTRAINT IF EXISTS patient_medical_vault_record_type_check;

-- Recreate with full list (12 types)
ALTER TABLE patient_medical_vault
ADD CONSTRAINT patient_medical_vault_record_type_check
CHECK (record_type IN (
    'allergy',
    'condition',
    'medication',
    'vital_sign',
    'immunization',
    'procedure',
    'note',
    'lab_result',
    'pharmacy',
    'emergency_contact',
    'document',
    'follow_up'
));