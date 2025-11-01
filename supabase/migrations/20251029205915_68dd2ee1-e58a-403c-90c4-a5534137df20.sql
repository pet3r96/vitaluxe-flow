-- Fix RLS INSERT policy for patient messages
-- The old policy incorrectly checked auth.uid() = patient_id
-- The correct check should be auth.uid() = sender_id

DROP POLICY IF EXISTS "Patients can send messages" ON patient_messages;

CREATE POLICY "Patients can send messages" ON patient_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id 
  AND sender_type = 'patient'
  AND patient_id IN (
    SELECT id FROM patient_accounts WHERE user_id = auth.uid()
  )
);