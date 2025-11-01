-- Update can_act_for_practice to correctly handle impersonation of providers, staff, and patients
-- and remove conflicting broad provider_documents policy

-- SAFETY: Set search_path to public to avoid security definer surprises
SET search_path = public;

-- Create or replace the function used by RLS to check if current user can act for a practice
CREATE OR REPLACE FUNCTION public.can_act_for_practice(p_practice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    -- User is the practice owner
    auth.uid() = p_practice_id
    OR
    -- User is a provider for this practice
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.user_id = auth.uid() AND p.practice_id = p_practice_id
    )
    OR
    -- User is staff for this practice
    EXISTS (
      SELECT 1 FROM public.practice_staff ps
      WHERE ps.user_id = auth.uid() AND ps.practice_id = p_practice_id
    )
    OR
    -- Admin is directly impersonating this practice owner
    EXISTS (
      SELECT 1 FROM public.active_impersonation_sessions ais
      WHERE ais.admin_user_id = auth.uid()
        AND ais.impersonated_user_id = p_practice_id
        AND ais.expires_at > now()
    )
    OR
    -- Admin is impersonating a provider in this practice
    EXISTS (
      SELECT 1
      FROM public.active_impersonation_sessions ais
      JOIN public.providers p ON p.user_id = ais.impersonated_user_id
      WHERE ais.admin_user_id = auth.uid()
        AND ais.expires_at > now()
        AND p.practice_id = p_practice_id
    )
    OR
    -- Admin is impersonating staff in this practice
    EXISTS (
      SELECT 1
      FROM public.active_impersonation_sessions ais
      JOIN public.practice_staff ps ON ps.user_id = ais.impersonated_user_id
      WHERE ais.admin_user_id = auth.uid()
        AND ais.expires_at > now()
        AND ps.practice_id = p_practice_id
    )
    OR
    -- Admin is impersonating a patient belonging to this practice
    EXISTS (
      SELECT 1
      FROM public.active_impersonation_sessions ais
      JOIN public.patient_accounts pa ON pa.user_id = ais.impersonated_user_id
      WHERE ais.admin_user_id = auth.uid()
        AND ais.expires_at > now()
        AND pa.practice_id = p_practice_id
    )
  );
END;
$$;

-- Remove an overly broad/conflicting policy on provider_documents, if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'provider_documents' 
      AND policyname = 'Practices can manage their own documents'
  ) THEN
    EXECUTE 'DROP POLICY "Practices can manage their own documents" ON public.provider_documents';
  END IF;
END $$;
