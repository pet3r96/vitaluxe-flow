-- Add UPDATE policy for practice team members on patient_follow_ups
DROP POLICY IF EXISTS "practice_team_can_update_follow_ups" ON patient_follow_ups;

CREATE POLICY "practice_team_can_update_follow_ups"
  ON patient_follow_ups
  FOR UPDATE
  USING (
    practice_id IN (
      -- Practice owners
      SELECT id FROM profiles WHERE id = auth.uid()
      UNION
      -- Providers in the practice
      SELECT practice_id FROM providers 
      WHERE user_id = auth.uid() AND active = true
      UNION
      -- Staff in the practice  
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    practice_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT practice_id FROM providers 
      WHERE user_id = auth.uid() AND active = true
      UNION
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  );