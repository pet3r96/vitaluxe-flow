-- Add INSERT policy for profiles table to allow authenticated users to create their own profile
-- This addresses the security finding about missing INSERT policy while maintaining security

CREATE POLICY "Users can insert their own profile"
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Add comment explaining the policy
COMMENT ON POLICY "Users can insert their own profile" ON public.profiles IS 
'Allows authenticated users to create their own profile entry. The WITH CHECK clause ensures users can only create profiles for their own auth.uid().';