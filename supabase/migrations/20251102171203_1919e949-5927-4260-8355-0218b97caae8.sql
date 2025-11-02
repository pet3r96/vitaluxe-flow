-- Clean up users with multiple conflicting roles
-- Priority order: admin > topline > downline > doctor > pharmacy > provider > staff > patient

-- First, let's create a function to determine the highest priority role for a user
CREATE OR REPLACE FUNCTION get_primary_role(p_user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role app_role;
BEGIN
  -- Get the highest priority role based on our precedence
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = p_user_id
  ORDER BY 
    CASE role::TEXT
      WHEN 'admin' THEN 1
      WHEN 'topline' THEN 2
      WHEN 'downline' THEN 3
      WHEN 'doctor' THEN 4
      WHEN 'pharmacy' THEN 5
      WHEN 'provider' THEN 6
      WHEN 'staff' THEN 7
      WHEN 'patient' THEN 8
      ELSE 99
    END
  LIMIT 1;
  
  RETURN v_role;
END;
$$;

-- Create a table to log the cleanup actions for audit purposes
CREATE TABLE IF NOT EXISTS public.role_cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT,
  removed_role TEXT NOT NULL,
  kept_role TEXT NOT NULL,
  cleaned_at TIMESTAMPTZ DEFAULT now()
);

-- Log users with multiple roles before cleanup
INSERT INTO public.role_cleanup_log (user_id, email, removed_role, kept_role)
SELECT 
  ur.user_id,
  au.email,
  ur.role::TEXT as removed_role,
  get_primary_role(ur.user_id)::TEXT as kept_role
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.role != get_primary_role(ur.user_id);

-- Delete non-primary roles, keeping only the highest priority role for each user
DELETE FROM user_roles
WHERE id IN (
  SELECT ur.id
  FROM user_roles ur
  WHERE ur.role != get_primary_role(ur.user_id)
);

-- Add a comment explaining the role priority system
COMMENT ON TABLE user_roles IS 'User roles table. Each user should have only ONE role. Priority order (highest to lowest): admin, topline, downline, doctor, pharmacy, provider, staff, patient. If multiple roles exist, the highest priority role should be kept.';