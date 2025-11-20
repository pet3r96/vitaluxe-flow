-- Fix: Add WITH CHECK clause to practice_team_update_vault policy
-- This prevents silent UPDATE failures for practice team members

DROP POLICY IF EXISTS "practice_team_update_vault" ON patient_medical_vault;

CREATE POLICY "practice_team_update_vault"
ON patient_medical_vault
FOR UPDATE
TO authenticated
USING (
  practice_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = patient_medical_vault.practice_id
      AND p.active = true
  )
  OR EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = patient_medical_vault.practice_id
      AND ps.active = true
  )
)
WITH CHECK (
  practice_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.practice_id = patient_medical_vault.practice_id
      AND p.active = true
  )
  OR EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.practice_id = patient_medical_vault.practice_id
      AND ps.active = true
  )
);