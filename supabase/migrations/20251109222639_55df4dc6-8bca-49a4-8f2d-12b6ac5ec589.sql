-- Backfill provider records for practice owners who don't have them
-- This fixes authorization issues when practice owners try to start video sessions

-- Insert provider records for users who are practice owners but missing from providers table
INSERT INTO public.providers (user_id, practice_id, role_type, active, can_order)
SELECT DISTINCT
  p.id as user_id,
  p.id as practice_id,
  'provider' as role_type,
  true as active,
  true as can_order
FROM public.profiles p
WHERE 
  -- User is a practice (their id is used as practice_id somewhere)
  EXISTS (
    SELECT 1 FROM public.patient_appointments pa 
    WHERE pa.practice_id = p.id
  )
  -- But they don't have a provider record yet
  AND NOT EXISTS (
    SELECT 1 FROM public.providers pr 
    WHERE pr.user_id = p.id
  )
  -- And they have a role that suggests they should be a provider
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id 
    AND ur.role IN ('doctor', 'provider', 'admin')
  );

-- Log the backfill
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % provider records for practice owners', inserted_count;
END $$;