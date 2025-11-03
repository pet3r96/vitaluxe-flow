-- Fix user_belongs_to_patient_practice to recognize practice owners
CREATE OR REPLACE FUNCTION public.user_belongs_to_patient_practice(_user_id uuid, _patient_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT pa.practice_id
    FROM public.patient_accounts pa
    WHERE pa.id = _patient_account_id
  )
  SELECT
    -- Admin users can access any patient
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role)
    OR
    -- Practice owner (doctor) can access their patients
    EXISTS (SELECT 1 FROM target t WHERE t.practice_id = _user_id)
    OR
    -- Active staff can access patients in their practice
    EXISTS (
      SELECT 1 
      FROM public.practice_staff ps 
      JOIN target t ON t.practice_id = ps.practice_id 
      WHERE ps.user_id = _user_id AND ps.active = true
    )
    OR
    -- Active providers can access patients in their practice
    EXISTS (
      SELECT 1 
      FROM public.providers pr 
      JOIN target t ON t.practice_id = pr.practice_id 
      WHERE pr.user_id = _user_id AND pr.active = true
    )
$$;

-- Add missing doctor policy for patient_accounts UPDATE
CREATE POLICY "Doctors can update their practice patients"
ON public.patient_accounts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'doctor'::app_role) AND practice_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) AND practice_id = auth.uid());

-- Add missing doctor policies for patient_follow_ups
CREATE POLICY "Doctors can view their practice follow-ups"
ON public.patient_follow_ups
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 
    FROM public.patient_accounts pa 
    WHERE pa.id = patient_follow_ups.patient_id 
    AND pa.practice_id = auth.uid()
  )
);

CREATE POLICY "Doctors can create follow-ups for their patients"
ON public.patient_follow_ups
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 
    FROM public.patient_accounts pa 
    WHERE pa.id = patient_follow_ups.patient_id 
    AND pa.practice_id = auth.uid()
  )
);

CREATE POLICY "Doctors can update their practice follow-ups"
ON public.patient_follow_ups
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 
    FROM public.patient_accounts pa 
    WHERE pa.id = patient_follow_ups.patient_id 
    AND pa.practice_id = auth.uid()
  )
);