-- Allow patients to view their practice's subscription status
CREATE POLICY "Patients can view their practice subscription"
ON public.practice_subscriptions
FOR SELECT
TO authenticated
USING (
  practice_id IN (
    SELECT practice_id 
    FROM patient_accounts 
    WHERE user_id = auth.uid()
  )
);