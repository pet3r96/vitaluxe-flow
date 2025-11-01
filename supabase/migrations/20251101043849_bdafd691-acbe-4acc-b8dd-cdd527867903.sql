-- Update the existing RLS policy on patient_accounts to include staff
-- This will fix the v_patients_with_portal_status view access for all practice users

-- Drop the existing policy
DROP POLICY IF EXISTS "Practices can view their patients" ON patient_accounts;

-- Recreate with staff support
CREATE POLICY "Practices can view their patients"
ON patient_accounts
FOR SELECT
USING (
  practice_id = auth.uid() 
  OR practice_id IN (
    SELECT practice_id FROM providers WHERE user_id = auth.uid()
  )
  OR practice_id IN (
    SELECT practice_id FROM practice_staff WHERE user_id = auth.uid()
  )
);