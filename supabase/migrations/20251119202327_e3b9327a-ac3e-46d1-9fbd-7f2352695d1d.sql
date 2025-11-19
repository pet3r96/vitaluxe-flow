-- Update RLS policy for practice_rooms to support broader access
DROP POLICY IF EXISTS "Practices can manage their rooms" ON public.practice_rooms;

-- Create updated policy without role check
CREATE POLICY "Practices can manage their rooms"
  ON public.practice_rooms
  FOR ALL
  USING (
    -- Practice owners
    practice_id = auth.uid() 
    
    -- Staff members
    OR practice_id IN (
      SELECT practice_id 
      FROM practice_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    practice_id = auth.uid() 
    OR practice_id IN (
      SELECT practice_id 
      FROM practice_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  );