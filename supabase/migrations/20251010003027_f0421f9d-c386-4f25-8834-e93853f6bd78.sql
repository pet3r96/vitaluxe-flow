-- Migration: Enable Full Admin Impersonation
-- Description: Allow admins to perform UPDATE operations as impersonated users

-- Update profiles table policy to allow admins to update any profile
DROP POLICY IF EXISTS "Active users can update own profile" ON public.profiles;

CREATE POLICY "Active users can update own profile"
ON public.profiles
FOR UPDATE
USING (
  ((auth.uid() = id) AND (active = true)) OR 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((auth.uid() = id) AND (active = true)) OR 
  has_role(auth.uid(), 'admin'::app_role)
);