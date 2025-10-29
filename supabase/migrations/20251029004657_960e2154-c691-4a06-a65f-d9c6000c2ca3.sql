-- Create practice_blocked_time table
CREATE TABLE public.practice_blocked_time (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES auth.users(id),
  block_type TEXT NOT NULL CHECK (block_type IN ('practice_closure', 'provider_unavailable')),
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT valid_block_times CHECK (end_time > start_time),
  CONSTRAINT provider_required_if_provider_block CHECK (
    (block_type = 'provider_unavailable' AND provider_id IS NOT NULL) OR
    (block_type = 'practice_closure' AND provider_id IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_blocked_time_practice ON public.practice_blocked_time(practice_id);
CREATE INDEX idx_blocked_time_provider ON public.practice_blocked_time(provider_id);
CREATE INDEX idx_blocked_time_dates ON public.practice_blocked_time(start_time, end_time);
CREATE INDEX idx_blocked_time_type ON public.practice_blocked_time(block_type);

-- RLS Policies
ALTER TABLE public.practice_blocked_time ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all blocked time"
  ON public.practice_blocked_time FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Practice owners and ALL STAFF can manage blocked time for their practice
CREATE POLICY "Practice owners and staff can manage blocked time"
  ON public.practice_blocked_time FOR ALL
  USING (
    practice_id = auth.uid() OR 
    practice_id IN (SELECT practice_id FROM public.practice_staff WHERE user_id = auth.uid() AND active = true)
  );

-- Providers can only manage their own blocked time
CREATE POLICY "Providers can manage own blocked time"
  ON public.practice_blocked_time FOR ALL
  USING (
    provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  );

-- Function to check for conflicting appointments
CREATE OR REPLACE FUNCTION public.get_appointments_during_blocked_time(
  p_practice_id UUID,
  p_provider_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_end_time TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  appointment_id UUID,
  patient_name TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  provider_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.id,
    CONCAT(patient.first_name, ' ', patient.last_name) as patient_name,
    pa.start_time,
    pa.end_time,
    prof.name as provider_name
  FROM public.patient_appointments pa
  JOIN public.patient_accounts patient ON pa.patient_id = patient.id
  LEFT JOIN public.providers prov ON pa.provider_id = prov.id
  LEFT JOIN public.profiles prof ON prov.user_id = prof.id
  WHERE pa.practice_id = p_practice_id
    AND pa.status NOT IN ('cancelled', 'no_show', 'completed')
    AND pa.start_time < p_end_time
    AND pa.end_time > p_start_time
    AND (p_provider_id IS NULL OR pa.provider_id = p_provider_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Service Types System

-- Add service type columns to appointments
ALTER TABLE public.patient_appointments 
ADD COLUMN IF NOT EXISTS service_type TEXT,
ADD COLUMN IF NOT EXISTS service_description TEXT;

-- Add constraint for valid service types
ALTER TABLE public.patient_appointments
ADD CONSTRAINT valid_service_type CHECK (
  service_type IS NULL OR service_type IN (
    'consultations_followups',
    'bloodwork',
    'injectables',
    'skin_treatments',
    'laser_energy',
    'body_contouring',
    'iv_therapy',
    'facials_aesthetic',
    'skincare_programs',
    'addons_enhancements',
    'other'
  )
);

CREATE INDEX IF NOT EXISTS idx_appointments_service_type ON public.patient_appointments(service_type);

-- Create service types lookup table
CREATE TABLE public.appointment_service_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  typical_duration_minutes INTEGER,
  requires_provider BOOLEAN DEFAULT true,
  sort_order INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Seed service types
INSERT INTO public.appointment_service_types (id, name, category, description, typical_duration_minutes, sort_order) VALUES
  ('consultations_followups', 'Consultations & Follow-Ups', 'medical', 'Initial consultations, follow-up visits, and treatment reviews', 30, 1),
  ('bloodwork', 'Bloodwork', 'diagnostic', 'Blood tests, lab work, and diagnostic screenings', 15, 2),
  ('injectables', 'Injectables', 'cosmetic', 'Botox, fillers, and other injectable treatments', 45, 3),
  ('skin_treatments', 'Skin Treatments', 'cosmetic', 'Chemical peels, microneedling, and other skin procedures', 60, 4),
  ('laser_energy', 'Laser & Energy Services', 'cosmetic', 'Laser hair removal, IPL, radiofrequency treatments', 60, 5),
  ('body_contouring', 'Body Contouring', 'cosmetic', 'CoolSculpting, body sculpting, and contouring procedures', 90, 6),
  ('iv_therapy', 'IV Therapy & Wellness', 'wellness', 'IV vitamin infusions and wellness treatments', 45, 7),
  ('facials_aesthetic', 'Facials & Aesthetic Care', 'cosmetic', 'Facials, dermaplaning, and aesthetic skincare', 60, 8),
  ('skincare_programs', 'Skincare Programs', 'program', 'Personalized skincare regimens and program consultations', 30, 9),
  ('addons_enhancements', 'Add-Ons & Enhancements', 'addon', 'Additional services and treatment enhancements', 15, 10),
  ('other', 'Other', 'other', 'Other appointment types not listed above', 30, 11);

-- RLS
ALTER TABLE public.appointment_service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service types viewable by authenticated users"
  ON public.appointment_service_types FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage service types"
  ON public.appointment_service_types FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.practice_blocked_time IS 'Stores blocked time periods for practices and providers';
COMMENT ON COLUMN public.practice_blocked_time.block_type IS 'practice_closure blocks entire practice, provider_unavailable blocks specific provider';
COMMENT ON TABLE public.appointment_service_types IS 'Lookup table for appointment service types and categories';