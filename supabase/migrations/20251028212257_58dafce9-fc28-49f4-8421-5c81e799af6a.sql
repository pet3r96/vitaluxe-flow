-- Phase 1: Add 'staff' role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'staff';

-- Phase 2: Create practice_staff table
CREATE TABLE IF NOT EXISTS public.practice_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on practice_staff
ALTER TABLE public.practice_staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for practice_staff
CREATE POLICY "Admins can manage all staff" ON public.practice_staff
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can manage their own staff" ON public.practice_staff
  FOR ALL USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());

CREATE POLICY "Staff can view their own record" ON public.practice_staff
  FOR SELECT USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_staff_practice_id ON public.practice_staff(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_staff_user_id ON public.practice_staff(user_id);

-- Phase 3: Add staff_role_type column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_role_type TEXT;