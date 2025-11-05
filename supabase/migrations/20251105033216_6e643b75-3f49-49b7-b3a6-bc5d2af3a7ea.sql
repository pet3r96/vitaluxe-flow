-- Add RLS policy for staff to view profiles of providers in their practice
-- This fixes the treatment plan creation issue where staff can't see provider names

CREATE POLICY "Staff can view practice provider profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM practice_staff ps
    JOIN providers p ON p.practice_id = ps.practice_id
    WHERE ps.user_id = auth.uid()
    AND ps.active = true
    AND p.user_id = profiles.id
  )
);