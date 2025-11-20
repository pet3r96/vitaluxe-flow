-- Fix provider shipping address access
-- Allow providers to read their practice profile's shipping address

-- Drop existing policy to recreate with provider access
DROP POLICY IF EXISTS "profiles_self_read_failsafe" ON public.profiles;

-- Recreate policy with provider access included
CREATE POLICY "profiles_self_read_failsafe"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can read their own profile
  id = auth.uid()
  OR
  -- Providers can read their practice's profile (for shipping address)
  id IN (
    SELECT practice_id 
    FROM providers 
    WHERE user_id = auth.uid() AND active = true
  )
  OR
  -- Practice owners can view their staff/provider profiles
  id IN (
    SELECT practice_staff.user_id FROM practice_staff
    WHERE practice_staff.practice_id = auth.uid() AND practice_staff.active = true
    UNION
    SELECT providers.user_id FROM providers
    WHERE providers.practice_id = auth.uid() AND providers.active = true
  )
  OR
  -- Staff can view other profiles in their practice
  id IN (
    SELECT p.user_id FROM providers p
    JOIN practice_staff ps ON ps.practice_id = p.practice_id
    WHERE ps.user_id = auth.uid() AND ps.active = true AND p.active = true
    UNION
    SELECT ps2.user_id FROM practice_staff ps2
    JOIN practice_staff ps ON ps.practice_id = ps2.practice_id
    WHERE ps.user_id = auth.uid() AND ps.active = true AND ps2.active = true
    UNION
    SELECT ps.practice_id FROM practice_staff ps
    WHERE ps.user_id = auth.uid() AND ps.active = true
  )
);