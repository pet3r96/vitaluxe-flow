-- Secure Admin Role Assignment System
-- Ensures only existing admins can assign admin roles

-- Drop existing policies on user_roles if any
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create secure RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Only admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- CRITICAL: Only existing admins can insert admin roles
CREATE POLICY "Only admins can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Only admins can delete roles
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create function to validate admin invitations
CREATE OR REPLACE FUNCTION public.can_create_admin(_inviter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Only existing admins can create new admins
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _inviter_id
      AND role = 'admin'::app_role
  )
$$;

-- Add constraint to profiles table to track who created admin accounts
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create audit log for admin role assignments
CREATE TABLE IF NOT EXISTS public.admin_role_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  notes text
);

-- Enable RLS on admin_role_audit
ALTER TABLE public.admin_role_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view the audit log
CREATE POLICY "Only admins can view admin audit log"
ON public.admin_role_audit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create trigger to log admin role assignments
CREATE OR REPLACE FUNCTION public.log_admin_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Only log when admin role is assigned
  IF NEW.role = 'admin'::app_role THEN
    -- Get email of the new admin
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = NEW.user_id;
    
    -- Log the assignment
    INSERT INTO public.admin_role_audit (
      assigned_to,
      assigned_by,
      email,
      notes
    ) VALUES (
      NEW.user_id,
      auth.uid(),
      v_email,
      'Admin role assigned'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_roles
DROP TRIGGER IF EXISTS log_admin_assignment ON public.user_roles;
CREATE TRIGGER log_admin_assignment
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_admin_role_assignment();

-- Ensure primary admin exists in profiles
DO $$
DECLARE
  v_admin_user_id uuid;
BEGIN
  -- Get the admin user ID from auth.users
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE LOWER(email) = 'info@vitaluxeservices.com'
  LIMIT 1;
  
  -- If admin exists, ensure they have a profile and admin role
  IF v_admin_user_id IS NOT NULL THEN
    -- Ensure profile exists
    INSERT INTO public.profiles (id, email, name, active, status, verified_at)
    VALUES (
      v_admin_user_id,
      'info@vitaluxeservices.com',
      'System Administrator',
      true,
      'active',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      status = 'active',
      active = true,
      verified_at = COALESCE(profiles.verified_at, now());
    
    -- Ensure admin role exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_user_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;