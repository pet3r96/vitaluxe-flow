-- Fix RLS for practice_branding to allow practice owners, providers, and admins via impersonation

ALTER TABLE public.practice_branding ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present to avoid duplicates
DROP POLICY IF EXISTS "Practice and impersonating admin can view branding" ON public.practice_branding;
DROP POLICY IF EXISTS "Practice and impersonating admin can insert branding" ON public.practice_branding;
DROP POLICY IF EXISTS "Practice and impersonating admin can update branding" ON public.practice_branding;

-- SELECT policy
CREATE POLICY "Practice and impersonating admin can view branding"
ON public.practice_branding
FOR SELECT
USING (
  (auth.uid() = practice_id)
  OR
  (practice_id IN (
    SELECT providers.practice_id
    FROM public.providers
    WHERE providers.user_id = auth.uid()
  ))
  OR
  EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND ais.impersonated_user_id = practice_branding.practice_id
  )
);

-- INSERT policy (covers UPSERT insert path)
CREATE POLICY "Practice and impersonating admin can insert branding"
ON public.practice_branding
FOR INSERT
WITH CHECK (
  (auth.uid() = practice_id)
  OR
  (practice_id IN (
    SELECT providers.practice_id
    FROM public.providers
    WHERE providers.user_id = auth.uid()
  ))
  OR
  EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND ais.impersonated_user_id = practice_branding.practice_id
  )
);

-- UPDATE policy (covers UPSERT update path)
CREATE POLICY "Practice and impersonating admin can update branding"
ON public.practice_branding
FOR UPDATE
USING (
  (auth.uid() = practice_id)
  OR
  (practice_id IN (
    SELECT providers.practice_id
    FROM public.providers
    WHERE providers.user_id = auth.uid()
  ))
  OR
  EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND ais.impersonated_user_id = practice_branding.practice_id
  )
)
WITH CHECK (
  (auth.uid() = practice_id)
  OR
  (practice_id IN (
    SELECT providers.practice_id
    FROM public.providers
    WHERE providers.user_id = auth.uid()
  ))
  OR
  EXISTS (
    SELECT 1
    FROM public.active_impersonation_sessions ais
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND ais.impersonated_user_id = practice_branding.practice_id
  )
);
