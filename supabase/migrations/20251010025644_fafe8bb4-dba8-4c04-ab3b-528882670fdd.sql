-- Rename provider_payment_methods table to practice_payment_methods
ALTER TABLE public.provider_payment_methods 
RENAME TO practice_payment_methods;

-- Rename provider_id column to practice_id in practice_payment_methods
ALTER TABLE public.practice_payment_methods 
RENAME COLUMN provider_id TO practice_id;

-- Rename provider_id column to practice_id in patients table
ALTER TABLE public.patients 
RENAME COLUMN provider_id TO practice_id;

-- Rename repaired_providers column to repaired_practices in sync_logs
ALTER TABLE public.sync_logs 
RENAME COLUMN repaired_providers TO repaired_practices;

-- Drop existing RLS policies on practice_payment_methods (old provider_payment_methods)
DROP POLICY IF EXISTS "Admins can manage all payment methods" ON public.practice_payment_methods;
DROP POLICY IF EXISTS "Providers can delete their own payment methods" ON public.practice_payment_methods;
DROP POLICY IF EXISTS "Providers can insert their own payment methods" ON public.practice_payment_methods;
DROP POLICY IF EXISTS "Providers can update their own payment methods" ON public.practice_payment_methods;
DROP POLICY IF EXISTS "Providers can view their own payment methods" ON public.practice_payment_methods;

-- Recreate RLS policies with new naming
CREATE POLICY "Admins can manage all payment methods" 
ON public.practice_payment_methods 
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can delete their own payment methods" 
ON public.practice_payment_methods 
FOR DELETE
TO authenticated
USING (auth.uid() = practice_id);

CREATE POLICY "Practices can insert their own payment methods" 
ON public.practice_payment_methods 
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = practice_id);

CREATE POLICY "Practices can update their own payment methods" 
ON public.practice_payment_methods 
FOR UPDATE
TO authenticated
USING (auth.uid() = practice_id);

CREATE POLICY "Practices can view their own payment methods" 
ON public.practice_payment_methods 
FOR SELECT
TO authenticated
USING (auth.uid() = practice_id);