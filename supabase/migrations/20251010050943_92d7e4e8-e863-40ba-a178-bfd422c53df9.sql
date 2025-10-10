-- Drop existing misleading policies on patients table
DROP POLICY IF EXISTS "Admins can create patients" ON public.patients;
DROP POLICY IF EXISTS "Admins can delete patients" ON public.patients;
DROP POLICY IF EXISTS "Admins can update patients" ON public.patients;
DROP POLICY IF EXISTS "Admins can view all patients" ON public.patients;
DROP POLICY IF EXISTS "Providers can create patients" ON public.patients;
DROP POLICY IF EXISTS "Providers can update their own patients" ON public.patients;
DROP POLICY IF EXISTS "Providers can view their own patients" ON public.patients;

-- Create new comprehensive RLS policies for patients table

-- SELECT policies
CREATE POLICY "Admins can view all patients"
ON public.patients
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can view their practice patients"
ON public.patients
FOR SELECT
USING (
  has_role(auth.uid(), 'doctor'::app_role) 
  AND practice_id = auth.uid()
);

CREATE POLICY "Providers can view their practice patients"
ON public.patients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = patients.practice_id
  )
);

-- INSERT policies
CREATE POLICY "Admins can create patients"
ON public.patients
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can create patients for their practice"
ON public.patients
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role) 
  AND practice_id = auth.uid()
);

CREATE POLICY "Providers can create patients for their practice"
ON public.patients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = patients.practice_id
  )
);

-- UPDATE policies
CREATE POLICY "Admins can update all patients"
ON public.patients
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can update their practice patients"
ON public.patients
FOR UPDATE
USING (
  has_role(auth.uid(), 'doctor'::app_role) 
  AND practice_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role) 
  AND practice_id = auth.uid()
);

CREATE POLICY "Providers can update their practice patients"
ON public.patients
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = patients.practice_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = patients.practice_id
  )
);