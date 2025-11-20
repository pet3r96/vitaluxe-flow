-- Fix Provider Internal Message RLS Policy
-- Drop the existing restrictive policy that only checks practice_staff
DROP POLICY IF EXISTS "staff_insert_internal_messages" ON internal_messages;

-- Create a comprehensive INSERT policy for all practice team members
-- This allows practice owners, staff, AND providers to create internal messages
CREATE POLICY "practice_team_insert_internal_messages"
  ON internal_messages
  FOR INSERT
  WITH CHECK (
    -- Practice owner can create messages in their practice
    practice_id = auth.uid()
    OR
    -- Staff member can create messages in their practice
    EXISTS (
      SELECT 1 FROM practice_staff
      WHERE user_id = auth.uid()
        AND practice_id = internal_messages.practice_id
        AND active = true
    )
    OR
    -- Provider can create messages in their practice
    EXISTS (
      SELECT 1 FROM providers
      WHERE user_id = auth.uid()
        AND practice_id = internal_messages.practice_id
        AND active = true
    )
  );

COMMENT ON POLICY "practice_team_insert_internal_messages" ON internal_messages 
  IS 'Allow practice owners, staff, and providers to create internal messages';