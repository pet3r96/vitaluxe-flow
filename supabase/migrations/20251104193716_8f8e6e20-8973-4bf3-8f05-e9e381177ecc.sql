-- Add policy to allow practice members to view their practice profile
-- This fixes the 406 error when fetching practice data for prescription writer

CREATE POLICY "Practice members can view their practice profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers 
    WHERE providers.practice_id = profiles.id 
    AND providers.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.practice_staff 
    WHERE practice_staff.practice_id = profiles.id 
    AND practice_staff.user_id = auth.uid()
  )
);