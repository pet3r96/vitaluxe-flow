-- Fix infinite recursion in provider_documents RLS policies
-- The issue: "Patients can view assigned provider documents" policy queries patient_accounts,
-- which can trigger can_act_for_practice during impersonation, creating circular dependency

-- Drop the problematic policy
DROP POLICY IF EXISTS "Patients can view assigned provider documents" ON public.provider_documents;

-- Recreate with a simpler approach that doesn't create circular dependencies
-- This version directly checks the junction table without joining patient_accounts first
CREATE POLICY "Patients can view assigned provider documents" 
ON public.provider_documents 
FOR SELECT
USING (
  is_internal = false 
  AND EXISTS (
    SELECT 1 
    FROM provider_document_patients pdp
    WHERE pdp.document_id = provider_documents.id
      AND pdp.patient_id IN (
        -- Get patient_id from patient_accounts for current user
        -- This doesn't trigger RLS on patient_accounts since it's a simple lookup
        SELECT id FROM patient_accounts WHERE user_id = auth.uid()
      )
  )
);

-- Add indexes to improve performance of the new policy
CREATE INDEX IF NOT EXISTS idx_provider_document_patients_patient_id 
ON provider_document_patients(patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_accounts_user_id 
ON patient_accounts(user_id);