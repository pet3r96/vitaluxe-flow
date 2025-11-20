-- Phase 1: Add Practice Owner SELECT Policy for Follow-Ups
CREATE POLICY "practice_owners_view_follow_ups"
ON patient_follow_ups FOR SELECT
USING (practice_id = auth.uid());

-- Phase 2: Create Missing Table for Unified Documents
CREATE TABLE IF NOT EXISTS provider_document_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES provider_documents(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(document_id, patient_id)
);

-- Enable RLS on provider_document_patients
ALTER TABLE provider_document_patients ENABLE ROW LEVEL SECURITY;

-- Allow practice team to manage document-patient assignments
CREATE POLICY "practice_team_manage_document_assignments"
ON provider_document_patients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM provider_documents pd
    WHERE pd.id = provider_document_patients.document_id
    AND (
      pd.practice_id = auth.uid()
      OR EXISTS (SELECT 1 FROM providers WHERE user_id = auth.uid() AND practice_id = pd.practice_id)
      OR EXISTS (SELECT 1 FROM practice_staff WHERE user_id = auth.uid() AND practice_id = pd.practice_id)
    )
  )
);

-- Phase 3: Remove Duplicate Vault INSERT Policy
DROP POLICY IF EXISTS "practice_team_insert_vault" ON patient_medical_vault;