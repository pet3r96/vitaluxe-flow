-- Add RLS policy to allow realtime subscriptions for authenticated users
CREATE POLICY "Allow realtime subscriptions for authenticated users"
ON practice_subscriptions
FOR SELECT
TO authenticated
USING (
  -- Practice users can see their own subscription
  practice_id = auth.uid()

  -- Patients can see their practice's subscription
  OR practice_id IN (
    SELECT practice_id 
    FROM patient_accounts 
    WHERE user_id = auth.uid()
  )

  -- Admins can see all
  OR EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);