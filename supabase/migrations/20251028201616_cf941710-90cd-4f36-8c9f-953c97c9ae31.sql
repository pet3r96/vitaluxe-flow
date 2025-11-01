-- Create appointment_settings table
CREATE TABLE IF NOT EXISTS public.appointment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  slot_duration INTEGER NOT NULL DEFAULT 15 CHECK (slot_duration IN (15, 30, 45, 60)),
  start_hour INTEGER NOT NULL DEFAULT 8 CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INTEGER NOT NULL DEFAULT 18 CHECK (end_hour >= 0 AND end_hour <= 23),
  working_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  buffer_time INTEGER NOT NULL DEFAULT 0,
  allow_overlap BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_appointment_settings_practice ON public.appointment_settings(practice_id);

ALTER TABLE public.appointment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all appointment settings"
  ON public.appointment_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices manage their own appointment settings"
  ON public.appointment_settings FOR ALL
  USING (
    practice_id = auth.uid() OR 
    practice_id IN (SELECT practice_id FROM public.providers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    practice_id = auth.uid() OR 
    practice_id IN (SELECT practice_id FROM public.providers WHERE user_id = auth.uid())
  );

-- Create practice_rooms table
CREATE TABLE IF NOT EXISTS public.practice_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  active BOOLEAN NOT NULL DEFAULT true,
  capacity INTEGER DEFAULT 1,
  equipment JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(practice_id, name)
);

CREATE INDEX idx_practice_rooms_practice ON public.practice_rooms(practice_id);
CREATE INDEX idx_practice_rooms_active ON public.practice_rooms(active);

ALTER TABLE public.practice_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all practice rooms"
  ON public.practice_rooms FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices manage their own rooms"
  ON public.practice_rooms FOR ALL
  USING (
    practice_id = auth.uid() OR 
    practice_id IN (SELECT practice_id FROM public.providers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    practice_id = auth.uid() OR 
    practice_id IN (SELECT practice_id FROM public.providers WHERE user_id = auth.uid())
  );

-- Add room_id column to patient_appointments
ALTER TABLE public.patient_appointments 
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.practice_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_room ON public.patient_appointments(room_id);