-- Fix SMS Verification Security
-- Drop overly permissive public access policies
DROP POLICY IF EXISTS "Anyone can read verification attempts" ON public.sms_verification_attempts;
DROP POLICY IF EXISTS "Anyone can create verification attempts" ON public.sms_verification_attempts;
DROP POLICY IF EXISTS "System can update verification attempts" ON public.sms_verification_attempts;

-- Add admin-only monitoring policy
CREATE POLICY "Admins can view verification attempts"
ON public.sms_verification_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));