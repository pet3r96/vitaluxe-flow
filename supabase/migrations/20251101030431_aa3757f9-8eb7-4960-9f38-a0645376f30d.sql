-- Fix infinite recursion in provider_documents RLS policies
-- The issue: Multiple SELECT policies call can_act_for_practice() which checks patient_accounts,
-- creating circular dependencies during complex queries

-- Step 1: Create a security definer function to safely check practice access without triggering RLS
CREATE OR REPLACE FUNCTION public.user_can_access_practice_documents(p_practice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is an admin
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is a doctor in this practice
  IF EXISTS (
    SELECT 1 FROM doctor_profiles
    WHERE user_id = auth.uid() AND practice_id = p_practice_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is a provider in this practice
  IF EXISTS (
    SELECT 1 FROM providers
    WHERE user_id = auth.uid() AND practice_id = p_practice_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is staff in this practice
  IF EXISTS (
    SELECT 1 FROM staff_profiles
    WHERE user_id = auth.uid() AND practice_id = p_practice_id
  ) THEN
    RETURN true;
  END IF;

  -- Check for active admin impersonation session
  IF EXISTS (
    SELECT 1 FROM admin_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND (
        -- Impersonating a doctor
        EXISTS (
          SELECT 1 FROM doctor_profiles dp
          WHERE dp.user_id = ais.impersonated_user_id
            AND dp.practice_id = p_practice_id
        )
        OR
        -- Impersonating a provider
        EXISTS (
          SELECT 1 FROM providers prov
          WHERE prov.user_id = ais.impersonated_user_id
            AND prov.practice_id = p_practice_id
        )
        OR
        -- Impersonating a staff member
        EXISTS (
          SELECT 1 FROM staff_profiles sp
          WHERE sp.user_id = ais.impersonated_user_id
            AND sp.practice_id = p_practice_id
        )
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Step 2: Replace the problematic RLS policies with ones using the security definer function
DROP POLICY IF EXISTS "Provider documents select" ON public.provider_documents;
DROP POLICY IF EXISTS "Provider documents insert" ON public.provider_documents;
DROP POLICY IF EXISTS "Provider documents update" ON public.provider_documents;
DROP POLICY IF EXISTS "Provider documents delete" ON public.provider_documents;

CREATE POLICY "Provider documents select"
ON public.provider_documents FOR SELECT
USING (user_can_access_practice_documents(practice_id));

CREATE POLICY "Provider documents insert"
ON public.provider_documents FOR INSERT
WITH CHECK (user_can_access_practice_documents(practice_id));

CREATE POLICY "Provider documents update"
ON public.provider_documents FOR UPDATE
USING (user_can_access_practice_documents(practice_id));

CREATE POLICY "Provider documents delete"
ON public.provider_documents FOR DELETE
USING (user_can_access_practice_documents(practice_id));

-- Add comment for documentation
COMMENT ON FUNCTION public.user_can_access_practice_documents IS 
'Security definer function to check if user can access practice documents without triggering RLS recursion';