-- Drop existing policy that doesn't allow admin access
DROP POLICY IF EXISTS "practice_team_manage_calendar_hours" ON public.practice_calendar_hours;

-- Recreate policy with admin access
CREATE POLICY "practice_team_manage_calendar_hours"
ON public.practice_calendar_hours FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR practice_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM providers p 
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = practice_calendar_hours.practice_id 
    AND p.active = true
  )
  OR EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.practice_id = practice_calendar_hours.practice_id 
    AND ps.active = true
  )
);