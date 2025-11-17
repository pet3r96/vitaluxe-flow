-- Unify terms system: Add patient terms to terms_and_conditions

-- 1. Add unique constraint on role and version
ALTER TABLE public.terms_and_conditions 
ADD CONSTRAINT terms_and_conditions_role_version_key UNIQUE (role, version);

-- 2. Insert patient terms into terms_and_conditions
INSERT INTO public.terms_and_conditions (
  role,
  title,
  content,
  version,
  effective_date,
  created_at,
  updated_at
)
SELECT 
  'patient'::app_role as role,
  title,
  content,
  version,
  now() as effective_date,
  created_at,
  updated_at
FROM public.patient_portal_terms
WHERE is_active = true
ORDER BY version DESC
LIMIT 1
ON CONFLICT (role, version) DO NOTHING;

-- 3. Update existing user_terms_acceptances for patients to link to new terms_id
UPDATE public.user_terms_acceptances uta
SET terms_id = tc.id
FROM public.terms_and_conditions tc
WHERE uta.role = 'patient'::app_role 
  AND tc.role = 'patient'::app_role 
  AND uta.version = tc.version
  AND uta.terms_id IS NULL;

-- 4. Add index for patient role queries
CREATE INDEX IF NOT EXISTS idx_terms_and_conditions_patient_role 
ON public.terms_and_conditions(role, version DESC) 
WHERE role = 'patient'::app_role;

-- 5. Mark patient_portal_terms as deprecated
COMMENT ON TABLE public.patient_portal_terms IS 'DEPRECATED: Legacy table for patient terms. All terms now managed in terms_and_conditions table. Kept for historical reference only.';