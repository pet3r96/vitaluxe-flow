-- Drop existing policy
DROP POLICY IF EXISTS "Patients select" ON patients;

-- Create new policy that supports impersonation
CREATE POLICY "Patients select" ON patients
FOR SELECT
USING (
  can_act_for_practice(practice_id)
  OR
  -- Allow access during impersonation
  practice_id IN (
    SELECT practice_id FROM providers WHERE user_id IN (
      SELECT impersonated_user_id FROM active_impersonation_sessions 
      WHERE admin_user_id = auth.uid() AND expires_at > now()
    )
    UNION
    SELECT practice_id FROM practice_staff WHERE user_id IN (
      SELECT impersonated_user_id FROM active_impersonation_sessions 
      WHERE admin_user_id = auth.uid() AND expires_at > now()
    )
  )
);