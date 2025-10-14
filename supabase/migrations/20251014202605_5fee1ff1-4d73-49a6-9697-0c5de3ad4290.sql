-- ============================================================================
-- PHASE 1: CRITICAL DATABASE SECURITY
-- Enable RLS on encryption_keys table and add admin-only policies
-- ============================================================================

-- Enable RLS on encryption_keys table
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can view encryption keys
CREATE POLICY "Admins can view encryption keys"
ON public.encryption_keys
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage encryption keys
CREATE POLICY "Admins can manage encryption keys"
ON public.encryption_keys
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- PHASE 2: CRITICAL AUTH SECURITY
-- Replace hardcoded impersonation email with database-driven permissions
-- ============================================================================

-- Create impersonation_permissions table
CREATE TABLE IF NOT EXISTS public.impersonation_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_impersonate BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on impersonation_permissions
ALTER TABLE public.impersonation_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can view impersonation permissions
CREATE POLICY "Admins can view impersonation permissions"
ON public.impersonation_permissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage impersonation permissions
CREATE POLICY "Admins can manage impersonation permissions"
ON public.impersonation_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own impersonation permission status
CREATE POLICY "Users can view their own impersonation status"
ON public.impersonation_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create function to check if user can impersonate
CREATE OR REPLACE FUNCTION public.can_user_impersonate(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.impersonation_permissions
    WHERE user_id = _user_id
      AND can_impersonate = true
      AND revoked_at IS NULL
  ) AND has_role(_user_id, 'admin'::app_role);
$$;

-- Grant the default admin impersonation permission
-- Insert for admin@vitaluxeservice.com user if they exist
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@vitaluxeservice.com'
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.impersonation_permissions (user_id, can_impersonate, notes, granted_by)
    VALUES (admin_user_id, true, 'Default admin impersonation permission', admin_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_impersonation_permissions_updated_at
BEFORE UPDATE ON public.impersonation_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_impersonation_permissions_user_id 
ON public.impersonation_permissions(user_id) 
WHERE can_impersonate = true AND revoked_at IS NULL;