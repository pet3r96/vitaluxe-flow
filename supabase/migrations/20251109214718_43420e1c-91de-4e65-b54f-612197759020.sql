-- Step 1: Add role_type and can_order columns to providers table
ALTER TABLE public.providers 
ADD COLUMN IF NOT EXISTS role_type TEXT NOT NULL DEFAULT 'provider',
ADD COLUMN IF NOT EXISTS can_order BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Add CHECK constraint for valid role types
ALTER TABLE public.providers
ADD CONSTRAINT valid_role_type CHECK (role_type IN ('provider', 'staff_ma', 'staff_admin', 'staff_receptionist', 'staff_other'));

-- Step 3: Migrate existing practice_staff records to providers table
INSERT INTO public.providers (
  user_id,
  practice_id,
  role_type,
  can_order,
  active,
  created_at,
  updated_at
)
SELECT 
  ps.user_id,
  ps.practice_id,
  CASE 
    WHEN ps.role_type = 'Medical Assistant' THEN 'staff_ma'
    WHEN ps.role_type = 'Administrator' THEN 'staff_admin'
    WHEN ps.role_type = 'Receptionist' THEN 'staff_receptionist'
    ELSE 'staff_other'
  END,
  ps.can_order,
  ps.active,
  ps.created_at,
  ps.updated_at
FROM public.practice_staff ps
WHERE NOT EXISTS (
  -- Prevent duplicate entries if staff already exists in providers
  SELECT 1 FROM public.providers prov 
  WHERE prov.user_id = ps.user_id 
  AND prov.practice_id = ps.practice_id
);

-- Step 4: Update RLS policies on providers table to include staff access
DROP POLICY IF EXISTS "Users can view providers in their practice" ON public.providers;
DROP POLICY IF EXISTS "Practice owners can manage their providers" ON public.providers;
DROP POLICY IF EXISTS "Providers can view their own record" ON public.providers;

-- Allow viewing providers and staff in user's practice
CREATE POLICY "Users can view providers and staff in their practice"
ON public.providers FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role IN ('admin', 'doctor', 'staff', 'provider')
  )
  AND (
    -- Admins and doctors (practice owners) can see all in any practice
    (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'doctor')))
    OR
    -- Staff can see providers/staff in their practice
    (practice_id IN (SELECT practice_id FROM public.practice_staff WHERE user_id = auth.uid()))
    OR
    -- Providers can see their own record
    (user_id = auth.uid())
  )
);

-- Allow practice owners to manage providers and staff
CREATE POLICY "Practice owners can manage providers and staff"
ON public.providers FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'doctor')
  )
  AND (
    -- Doctors can manage their own practice
    (practice_id = auth.uid())
    OR
    -- Admins can manage any practice
    (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
  )
);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN public.providers.role_type IS 'Role type: provider (medical provider with NPI), staff_ma (medical assistant), staff_admin (administrator), staff_receptionist, staff_other';
COMMENT ON COLUMN public.providers.can_order IS 'Whether this provider/staff member can place prescription orders';