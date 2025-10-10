-- Allow downlines to view all toplines (needed for assignment dropdown)
CREATE POLICY "Downlines can view all toplines"
ON public.reps
FOR SELECT
TO authenticated
USING (
  -- Allow viewing if the record is a topline
  (role = 'topline'::app_role)
  AND
  -- And the current user is a downline
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
      AND ur.role = 'downline'::app_role
  )
);