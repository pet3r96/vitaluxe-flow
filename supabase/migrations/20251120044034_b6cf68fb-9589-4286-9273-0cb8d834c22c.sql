-- ============================================
-- COMPREHENSIVE FIX: RLS Policies for Follow-Ups and Medical Vault
-- ============================================

-- Issue #4: Add INSERT policy for patient_follow_ups (practice team can create follow-ups)
DO $$ 
BEGIN
  -- Drop policy if it exists, then create it
  DROP POLICY IF EXISTS "practice_team_can_insert_follow_ups" ON patient_follow_ups;
  
  CREATE POLICY "practice_team_can_insert_follow_ups"
  ON patient_follow_ups FOR INSERT
  WITH CHECK (
    practice_id IN (
      -- Practice owner
      SELECT id FROM profiles WHERE id = auth.uid()
      UNION
      -- Providers in the practice
      SELECT practice_id FROM providers WHERE user_id = auth.uid() AND active = true
      UNION
      -- Staff in the practice
      SELECT practice_id FROM practice_staff WHERE user_id = auth.uid() AND active = true
    )
  );
END $$;

-- Issue #7: Fix patient_medical_vault INSERT policy (add WITH CHECK clause)
DO $$ 
BEGIN
  -- Drop existing broken policy first
  DROP POLICY IF EXISTS "practice_team_can_insert_vault" ON patient_medical_vault;

  -- Create corrected policy with WITH CHECK
  CREATE POLICY "practice_team_can_insert_vault"
  ON patient_medical_vault FOR INSERT
  WITH CHECK (
    practice_id IN (
      -- Practice owner
      SELECT id FROM profiles WHERE id = auth.uid()
      UNION
      -- Providers in the practice
      SELECT practice_id FROM providers WHERE user_id = auth.uid() AND active = true
      UNION
      -- Staff in the practice
      SELECT practice_id FROM practice_staff WHERE user_id = auth.uid() AND active = true
    )
  );
END $$;