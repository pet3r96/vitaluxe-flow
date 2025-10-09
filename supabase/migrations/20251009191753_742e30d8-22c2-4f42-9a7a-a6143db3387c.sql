-- Enable realtime updates on profiles table for account status monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Update RLS policies to enforce active status
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Doctors can create orders" ON public.orders;

-- Recreate with active status enforcement
CREATE POLICY "Active users can view own profile"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = id AND active = true) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Active users can update own profile"
ON public.profiles
FOR UPDATE
USING (
  (auth.uid() = id AND active = true) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Prevent inactive users from creating orders
CREATE POLICY "Active doctors can create orders"
ON public.orders
FOR INSERT
WITH CHECK (
  auth.uid() = doctor_id AND
  has_role(auth.uid(), 'doctor'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND active = true
  )
);