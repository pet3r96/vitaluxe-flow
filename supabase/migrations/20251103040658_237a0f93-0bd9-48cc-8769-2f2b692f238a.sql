-- Fix user_belongs_to_patient_practice function to include active status checks
-- This ensures consistency with RLS policies that check ps.active = true and pr.active = true

CREATE OR REPLACE FUNCTION user_belongs_to_patient_practice(_user_id uuid, _patient_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = _patient_account_id
      AND (
        -- Check if user is ACTIVE practice staff
        EXISTS (
          SELECT 1 FROM public.practice_staff ps 
          WHERE ps.user_id = _user_id 
            AND ps.practice_id = pa.practice_id
            AND ps.active = true  -- CRITICAL: Must match RLS policy
        )
        -- Check if user is an ACTIVE provider
        OR EXISTS (
          SELECT 1 FROM public.providers pr 
          WHERE pr.user_id = _user_id 
            AND pr.practice_id = pa.practice_id
            AND pr.active = true  -- CRITICAL: Must match RLS policy
        )
        -- Check if user is an admin
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role
        )
      )
  );
$$;