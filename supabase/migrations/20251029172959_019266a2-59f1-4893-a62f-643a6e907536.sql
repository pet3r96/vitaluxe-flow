-- Fix RLS policies for patients table to allow practice access

-- Drop existing overly permissive policy if exists
DROP POLICY IF EXISTS "All authenticated users can view patients" ON public.patients;

-- Create proper policy for practices to view their own patients
CREATE POLICY "Practices can view their own patients"
ON public.patients
FOR SELECT
USING (
  practice_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow practices to manage their own patients
CREATE POLICY "Practices can manage their own patients"
ON public.patients
FOR ALL
USING (
  practice_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  practice_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);