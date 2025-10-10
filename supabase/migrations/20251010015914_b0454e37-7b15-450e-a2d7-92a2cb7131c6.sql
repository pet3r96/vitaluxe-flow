-- Add address verification fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS formatted_shipping_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_verification_status TEXT DEFAULT 'unverified' 
  CHECK (shipping_verification_status IN ('verified', 'invalid', 'manual', 'unverified'));

-- Create index for faster address verification queries
CREATE INDEX IF NOT EXISTS idx_patients_verification_status ON public.patients(address_verification_status);
CREATE INDEX IF NOT EXISTS idx_pharmacies_verification_status ON public.pharmacies(address_verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(address_verification_status);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_verification ON public.orders(shipping_verification_status);

-- Create function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_audit_id UUID;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    SELECT role INTO v_user_role FROM user_roles WHERE user_id = v_user_id LIMIT 1;
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    user_role,
    action_type,
    entity_type,
    entity_id,
    details,
    created_at
  )
  VALUES (
    v_user_id,
    v_user_email,
    v_user_role,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_details,
    now()
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- Create trigger to log address verification changes
CREATE OR REPLACE FUNCTION public.log_address_verification_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND 
      OLD.address_verification_status IS DISTINCT FROM NEW.address_verification_status) THEN
    
    PERFORM log_audit_event(
      'address_verification_updated',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.address_verification_status,
        'new_status', NEW.address_verification_status,
        'formatted_address', NEW.address_formatted,
        'verification_source', NEW.address_verification_source
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply triggers to all tables with address verification
DROP TRIGGER IF EXISTS trigger_log_patients_address_verification ON public.patients;
CREATE TRIGGER trigger_log_patients_address_verification
AFTER UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.log_address_verification_change();

DROP TRIGGER IF EXISTS trigger_log_pharmacies_address_verification ON public.pharmacies;
CREATE TRIGGER trigger_log_pharmacies_address_verification
AFTER UPDATE ON public.pharmacies
FOR EACH ROW
EXECUTE FUNCTION public.log_address_verification_change();

DROP TRIGGER IF EXISTS trigger_log_profiles_address_verification ON public.profiles;
CREATE TRIGGER trigger_log_profiles_address_verification
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_address_verification_change();

-- Enhanced RLS policies for admin impersonation with full context
-- Update profiles RLS to support impersonation context
DROP POLICY IF EXISTS "Active users can update own profile" ON public.profiles;
CREATE POLICY "Active users can update own profile"
ON public.profiles
FOR UPDATE
USING (
  (auth.uid() = id AND active = true) OR 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (auth.uid() = id AND active = true) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Update patients RLS to support admin impersonation
DROP POLICY IF EXISTS "Providers can update their own patients" ON public.patients;
CREATE POLICY "Providers can update their own patients"
ON public.patients
FOR UPDATE
USING (
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Grant execute on audit logging function
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_address_verification_change TO authenticated;