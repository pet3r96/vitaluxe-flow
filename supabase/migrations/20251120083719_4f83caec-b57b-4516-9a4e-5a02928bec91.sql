-- Fix 1.1: Add Patient Notes INSERT Policies for Providers/Staff/Practice Owners
CREATE POLICY "Providers can create patient notes"
ON patient_notes FOR INSERT
TO authenticated
WITH CHECK (
  patient_account_id IN (
    SELECT pa.id
    FROM patient_accounts pa
    JOIN providers p ON p.practice_id = pa.practice_id
    WHERE p.user_id = auth.uid() 
      AND p.active = true
  )
);

CREATE POLICY "Staff can create patient notes"
ON patient_notes FOR INSERT
TO authenticated
WITH CHECK (
  patient_account_id IN (
    SELECT pa.id
    FROM patient_accounts pa
    JOIN practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE ps.user_id = auth.uid() 
      AND ps.active = true
  )
);

CREATE POLICY "Practice owners can create patient notes"
ON patient_notes FOR INSERT
TO authenticated
WITH CHECK (
  patient_account_id IN (
    SELECT pa.id
    FROM patient_accounts pa
    WHERE pa.practice_id = auth.uid()
  )
);

-- Fix 1.2: Simplify messages RLS policy to allow authenticated users to send
DROP POLICY IF EXISTS "participants_insert_messages" ON messages;

CREATE POLICY "authenticated_can_send_messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
);

-- Fix 1.3: Remove Duplicate Payment Method Policies
DROP POLICY IF EXISTS "Practices can delete own payment methods" ON practice_payment_methods;
DROP POLICY IF EXISTS "Practices can insert own payment methods" ON practice_payment_methods;
DROP POLICY IF EXISTS "Practices can view own payment methods" ON practice_payment_methods;
DROP POLICY IF EXISTS "Admins can view all payment methods" ON practice_payment_methods;