-- Fix patient_accounts INSERT RLS policies for all roles
-- Drop any existing/conflicting policies
DROP POLICY IF EXISTS "Admins can create patient accounts" ON public.patient_accounts;
DROP POLICY IF EXISTS "Doctors can create patients for their practice" ON public.patient_accounts;
DROP POLICY IF EXISTS "Providers can create patients for their practice" ON public.patient_accounts;
DROP POLICY IF EXISTS "Staff can create patients for their practice" ON public.patient_accounts;

-- Create comprehensive INSERT policies for all roles

-- Admins can create patient accounts in any practice
CREATE POLICY "Admins can create patient accounts"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Doctors can create patients for their own practice
CREATE POLICY "Doctors can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND practice_id = auth.uid()
);

-- Providers can create patients for their practice
CREATE POLICY "Providers can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = patient_accounts.practice_id
  )
);

-- Staff can create patients for their practice (NEW)
CREATE POLICY "Staff can create patients for their practice"
ON public.patient_accounts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.practice_id = patient_accounts.practice_id
  )
);