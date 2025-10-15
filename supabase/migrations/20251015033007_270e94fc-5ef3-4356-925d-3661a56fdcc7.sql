-- Fix cross-role terms disclosure by restricting access to user's own roles
DROP POLICY IF EXISTS "Anyone can view terms" ON public.terms_and_conditions;

CREATE POLICY "Users can view terms for their roles"
ON public.terms_and_conditions FOR SELECT
USING (
  -- Admins can see all terms
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Users can only see terms for roles they have
  role IN (
    SELECT user_roles.role 
    FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()
  )
);