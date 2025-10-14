-- Security Hardening: Strengthen Profiles Table RLS Policies
-- Drop overly permissive policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view associated profiles" ON public.profiles;
DROP POLICY IF EXISTS "Providers can view their practice profile" ON public.profiles;
DROP POLICY IF EXISTS "Downlines can view assigned practice profiles" ON public.profiles;
DROP POLICY IF EXISTS "Toplines can view downline practice profiles" ON public.profiles;

-- Create strict self-view policy (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);
  END IF;
END $$;

-- Security Hardening: Protect Patient Data in Cart Lines
-- Add audit logging and stricter access controls

-- Create audit function for cart line access
CREATE OR REPLACE FUNCTION public.log_cart_line_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_audit_event(
    'cart_line_accessed',
    'cart_lines',
    NEW.id,
    jsonb_build_object(
      'patient_name', NEW.patient_name,
      'has_prescription', NEW.prescription_url IS NOT NULL,
      'destination_state', NEW.destination_state
    )
  );
  RETURN NEW;
END;
$$;

-- Add trigger for cart line access logging
DROP TRIGGER IF EXISTS trg_log_cart_line_access ON public.cart_lines;
CREATE TRIGGER trg_log_cart_line_access
AFTER INSERT OR UPDATE ON public.cart_lines
FOR EACH ROW
EXECUTE FUNCTION public.log_cart_line_access();

-- Create function to check if user is the cart owner
CREATE OR REPLACE FUNCTION public.is_cart_owner(_user_id uuid, _cart_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cart
    WHERE id = _cart_id AND doctor_id = _user_id
  )
$$;

-- Update cart_lines policies to be more restrictive
DROP POLICY IF EXISTS "Doctors can manage their cart lines" ON public.cart_lines;

-- Create granular cart line policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cart_lines' 
    AND policyname = 'Doctors can view their own cart lines'
  ) THEN
    CREATE POLICY "Doctors can view their own cart lines"
    ON public.cart_lines
    FOR SELECT
    USING (is_cart_owner(auth.uid(), cart_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cart_lines' 
    AND policyname = 'Doctors can insert their own cart lines'
  ) THEN
    CREATE POLICY "Doctors can insert their own cart lines"
    ON public.cart_lines
    FOR INSERT
    WITH CHECK (is_cart_owner(auth.uid(), cart_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cart_lines' 
    AND policyname = 'Doctors can update their own cart lines'
  ) THEN
    CREATE POLICY "Doctors can update their own cart lines"
    ON public.cart_lines
    FOR UPDATE
    USING (is_cart_owner(auth.uid(), cart_id))
    WITH CHECK (is_cart_owner(auth.uid(), cart_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cart_lines' 
    AND policyname = 'Doctors can delete their own cart lines'
  ) THEN
    CREATE POLICY "Doctors can delete their own cart lines"
    ON public.cart_lines
    FOR DELETE
    USING (is_cart_owner(auth.uid(), cart_id));
  END IF;
END $$;