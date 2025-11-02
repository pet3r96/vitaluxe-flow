-- Add policy allowing admins to insert pending practice requests for any user
-- This fixes RLS violations when admins impersonate reps and submit practice requests
CREATE POLICY "Admins can insert pending practice requests for any user"
ON public.pending_practices
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);