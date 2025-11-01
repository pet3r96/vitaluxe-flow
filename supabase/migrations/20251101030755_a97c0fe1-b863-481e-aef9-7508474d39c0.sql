-- Fix infinite recursion with correct table names
-- Step 1: Drop the problematic policies
DROP POLICY IF EXISTS "Provider documents select" ON public.provider_documents;
DROP POLICY IF EXISTS "Provider documents insert" ON public.provider_documents;
DROP POLICY IF EXISTS "Provider documents update" ON public.provider_documents;
DROP POLICY IF EXISTS "Provider documents delete" ON public.provider_documents;

-- Step 2: Drop the old function
DROP FUNCTION IF EXISTS public.user_can_access_practice_documents(uuid);

-- Step 3: Create corrected function using actual table names
CREATE FUNCTION public.user_can_access_practice_documents(p_practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  OR
  -- User is the practice owner
  auth.uid() = p_practice_id
  OR
  -- User is a provider for this practice
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid() AND p.practice_id = p_practice_id
  )
  OR
  -- User is staff for this practice
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid() AND ps.practice_id = p_practice_id
  )
  OR
  -- Admin impersonation (any type)
  EXISTS (
    SELECT 1 FROM active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND (
        ais.impersonated_user_id = p_practice_id
        OR EXISTS (
          SELECT 1 FROM providers prov
          WHERE prov.user_id = ais.impersonated_user_id AND prov.practice_id = p_practice_id
        )
        OR EXISTS (
          SELECT 1 FROM practice_staff ps
          WHERE ps.user_id = ais.impersonated_user_id AND ps.practice_id = p_practice_id
        )
      )
  );
$$;

-- Step 4: Recreate the policies using the new function
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