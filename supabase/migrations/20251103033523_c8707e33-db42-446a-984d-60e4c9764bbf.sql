-- ============================================================================
-- FIX ISSUE #2: Add UPDATE policies for patient_accounts (providers + staff)
-- ============================================================================

-- Add UPDATE policy for providers to update their practice patients
CREATE POLICY "Providers can update their practice patients"
ON patient_accounts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = patient_accounts.practice_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = patient_accounts.practice_id
  )
);

-- Add UPDATE policy for staff to update their practice patients
CREATE POLICY "Staff can update their practice patients"
ON patient_accounts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid() 
    AND ps.practice_id = patient_accounts.practice_id
    AND ps.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid() 
    AND ps.practice_id = patient_accounts.practice_id
    AND ps.active = true
  )
);

-- ============================================================================
-- FIX ISSUE #4: Add comprehensive policies for patient_follow_ups
-- ============================================================================

-- INSERT policy for providers
CREATE POLICY "Providers can create follow-ups for their practice patients"
ON patient_follow_ups FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN providers p ON p.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND p.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- INSERT policy for staff
CREATE POLICY "Staff can create follow-ups for their practice patients"
ON patient_follow_ups FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
  AND created_by = auth.uid()
);

-- UPDATE policy for providers
CREATE POLICY "Providers can update follow-ups for their practice patients"
ON patient_follow_ups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN providers p ON p.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN providers p ON p.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND p.user_id = auth.uid()
  )
);

-- UPDATE policy for staff
CREATE POLICY "Staff can update follow-ups for their practice patients"
ON patient_follow_ups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);

-- SELECT policy for providers
CREATE POLICY "Providers can view follow-ups for their practice patients"
ON patient_follow_ups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN providers p ON p.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND p.user_id = auth.uid()
  )
);

-- SELECT policy for staff
CREATE POLICY "Staff can view follow-ups for their practice patients"
ON patient_follow_ups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_accounts pa
    JOIN practice_staff ps ON ps.practice_id = pa.practice_id
    WHERE pa.id = patient_follow_ups.patient_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);