-- Drop the old policy that only works for practice owners
DROP POLICY IF EXISTS "Practices can manage their document assignments" ON provider_document_patients;

-- Create new policy that works for all practice members
CREATE POLICY "Practice members can manage document assignments"
ON provider_document_patients
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM provider_documents pd
    WHERE pd.id = provider_document_patients.document_id
      AND user_can_access_practice_documents(pd.practice_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM provider_documents pd
    WHERE pd.id = provider_document_patients.document_id
      AND user_can_access_practice_documents(pd.practice_id)
  )
);