-- Fix video_guest_tokens RLS policy - remove overly permissive access
-- This addresses the security finding: "Guest video tokens publicly readable"

-- Drop the overly permissive policy that allows all authenticated users to view all tokens
DROP POLICY IF EXISTS "Anyone can validate guest tokens" ON public.video_guest_tokens;

-- Add proper admin access for token management
CREATE POLICY "Admins can manage all video guest tokens"
ON public.video_guest_tokens
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Note: The existing "Practice members can view their guest tokens" policy remains
-- and properly restricts SELECT access to practice owners, providers, and staff only