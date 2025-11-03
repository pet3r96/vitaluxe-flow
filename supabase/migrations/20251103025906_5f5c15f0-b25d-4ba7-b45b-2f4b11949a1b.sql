-- Fix user_belongs_to_patient_practice function to use correct tables
-- This function is used by RLS policies on patient_vitals and other medical vault tables

CREATE OR REPLACE FUNCTION public.user_belongs_to_patient_practice(_user_id uuid, _patient_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patient_accounts pa
    WHERE pa.id = _patient_account_id
      AND (
           -- Check if user is practice staff
           EXISTS (
             SELECT 1 FROM public.practice_staff ps 
             WHERE ps.user_id = _user_id AND ps.practice_id = pa.practice_id
           )
           -- Check if user is a provider
        OR EXISTS (
             SELECT 1 FROM public.providers pr 
             WHERE pr.user_id = _user_id AND pr.practice_id = pa.practice_id
           )
           -- Check if user is an admin
        OR EXISTS (
             SELECT 1 FROM public.user_roles ur 
             WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role
           )
      )
  );
$$;