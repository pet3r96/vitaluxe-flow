-- Fix provider profile visibility for practice owners and staff
-- This fixes the "Not Set" issue where provider names and emails weren't showing

-- Phase 1: Update practice owner policy to include providers
DROP POLICY IF EXISTS "practice_owner_view_profiles" ON profiles;

CREATE POLICY "practice_owner_view_profiles"
  ON profiles FOR SELECT
  USING (
    -- Practice owners can see profiles of staff AND providers in their practice
    id IN (
      -- Staff members
      SELECT user_id FROM practice_staff 
      WHERE practice_id = auth.uid() AND active = true
      
      UNION
      
      -- Providers
      SELECT user_id FROM providers
      WHERE practice_id = auth.uid() AND active = true
    )
  );

COMMENT ON POLICY "practice_owner_view_profiles" ON profiles IS 
'Allows practice owners (doctors) to view profiles of all staff and providers in their practice. Uses UNION to combine practice_staff and providers tables.';

-- Phase 2: Create staff policy to view profiles in their practice
CREATE POLICY "staff_view_practice_profiles"
  ON profiles FOR SELECT
  USING (
    -- Staff can see profiles of users in their practice
    id IN (
      -- Providers in the same practice
      SELECT p.user_id
      FROM providers p
      INNER JOIN practice_staff ps ON ps.practice_id = p.practice_id
      WHERE ps.user_id = auth.uid() 
        AND ps.active = true
        AND p.active = true
      
      UNION
      
      -- Other staff in the same practice
      SELECT ps2.user_id
      FROM practice_staff ps2
      INNER JOIN practice_staff ps ON ps.practice_id = ps2.practice_id
      WHERE ps.user_id = auth.uid() 
        AND ps.active = true
        AND ps2.active = true
      
      UNION
      
      -- The practice owner (doctor)
      SELECT ps.practice_id
      FROM practice_staff ps
      WHERE ps.user_id = auth.uid()
        AND ps.active = true
    )
  );

COMMENT ON POLICY "staff_view_practice_profiles" ON profiles IS 
'Allows staff members to view profiles of providers, other staff, and the practice owner within their practice. Required for appointment creation, treatment plans, and internal messaging.';