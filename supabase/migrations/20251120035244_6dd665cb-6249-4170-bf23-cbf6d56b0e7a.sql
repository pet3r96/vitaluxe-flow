-- Phase 1.3: Create practice_calendar_hours table
CREATE TABLE IF NOT EXISTS public.practice_calendar_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(practice_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.practice_calendar_hours ENABLE ROW LEVEL SECURITY;

-- Practice team can manage their own calendar hours
CREATE POLICY "practice_team_manage_calendar_hours"
ON public.practice_calendar_hours FOR ALL TO authenticated
USING (
  practice_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM providers p 
    WHERE p.user_id = auth.uid() 
    AND p.practice_id = practice_calendar_hours.practice_id 
    AND p.active = true
  )
  OR EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.practice_id = practice_calendar_hours.practice_id 
    AND ps.active = true
  )
);

-- Patients can view calendar hours for their practice
CREATE POLICY "patients_view_practice_calendar_hours"
ON public.practice_calendar_hours FOR SELECT TO authenticated
USING (
  practice_id IN (
    SELECT practice_id 
    FROM patient_accounts 
    WHERE user_id = auth.uid()
  )
);

-- Add index for performance
CREATE INDEX idx_practice_calendar_hours_practice 
ON public.practice_calendar_hours(practice_id, day_of_week);