-- Add new columns to patient_appointments for enhanced tracking
ALTER TABLE public.patient_appointments 
ADD COLUMN IF NOT EXISTS reason_for_visit TEXT,
ADD COLUMN IF NOT EXISTS visit_type TEXT CHECK (visit_type IN ('in_person', 'virtual')) DEFAULT 'in_person',
ADD COLUMN IF NOT EXISTS visit_summary_url TEXT,
ADD COLUMN IF NOT EXISTS confirmation_type TEXT DEFAULT 'pending' CHECK (confirmation_type IN ('pending', 'confirmed', 'modified_by_practice')),
ADD COLUMN IF NOT EXISTS requested_date DATE,
ADD COLUMN IF NOT EXISTS requested_time TIME,
ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for quick filtering
CREATE INDEX IF NOT EXISTS idx_patient_appointments_confirmation_type 
ON public.patient_appointments(confirmation_type);

CREATE INDEX IF NOT EXISTS idx_patient_appointments_visit_summary 
ON public.patient_appointments(visit_summary_url) WHERE visit_summary_url IS NOT NULL;

-- Update status constraint to include all existing and new statuses
ALTER TABLE public.patient_appointments 
DROP CONSTRAINT IF EXISTS patient_appointments_status_check;

ALTER TABLE public.patient_appointments 
ADD CONSTRAINT patient_appointments_status_check 
CHECK (status IN ('pending', 'scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled', 'checked_in', 'being_treated'));

-- Add helpful comments
COMMENT ON COLUMN public.patient_appointments.confirmation_type IS 'Tracks appointment confirmation status: pending (awaiting practice approval), confirmed (practice accepted), modified_by_practice (practice changed time/date)';
COMMENT ON COLUMN public.patient_appointments.requested_date IS 'Original date requested by patient before practice confirmation';
COMMENT ON COLUMN public.patient_appointments.requested_time IS 'Original time requested by patient before practice confirmation';
COMMENT ON COLUMN public.patient_appointments.visit_type IS 'Type of visit: in_person or virtual';
COMMENT ON COLUMN public.patient_appointments.visit_summary_url IS 'URL to visit summary document uploaded by provider after appointment completion';