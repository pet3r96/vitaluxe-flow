-- Add missing columns to patient_documents table
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS share_with_practice boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_title text,
ADD COLUMN IF NOT EXISTS hidden_by_patient boolean DEFAULT false;

-- Update document_type constraint to include all types
ALTER TABLE patient_documents 
DROP CONSTRAINT IF EXISTS patient_documents_document_type_check;

ALTER TABLE patient_documents
ADD CONSTRAINT patient_documents_document_type_check 
CHECK (document_type IN ('lab_result', 'imaging', 'prescription', 'insurance', 'id', 'other', 'drivers_license', 'referral'));

-- Create index for provider queries
CREATE INDEX IF NOT EXISTS idx_patient_docs_practice_sharing 
ON patient_documents(patient_id, share_with_practice) 
WHERE share_with_practice = true;

-- Update RLS: Providers can only see documents shared with practice
DROP POLICY IF EXISTS "Providers can view patient documents" ON patient_documents;

CREATE POLICY "Providers can view shared patient documents"
ON patient_documents FOR SELECT
USING (
  share_with_practice = true 
  AND EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id IN (
      SELECT practice_id FROM patient_accounts WHERE user_id = patient_documents.patient_id
    )
  )
);