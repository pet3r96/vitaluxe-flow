-- Add intake completion tracking to patient_accounts
ALTER TABLE public.patient_accounts 
ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ NULL;

-- Add index for querying incomplete intakes
CREATE INDEX IF NOT EXISTS idx_patient_accounts_intake_incomplete 
ON public.patient_accounts(intake_completed_at) 
WHERE intake_completed_at IS NULL;

-- Ensure patient_vitals table exists with proper structure
CREATE TABLE IF NOT EXISTS public.patient_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  height DECIMAL,
  weight DECIMAL,
  date_recorded TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on patient_vitals
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;

-- Create policies for patient_vitals
CREATE POLICY "Users can view their own vitals"
ON public.patient_vitals FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own vitals"
ON public.patient_vitals FOR INSERT
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own vitals"
ON public.patient_vitals FOR UPDATE
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Ensure patient_pharmacies table exists
CREATE TABLE IF NOT EXISTS public.patient_pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  pharmacy_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on patient_pharmacies
ALTER TABLE public.patient_pharmacies ENABLE ROW LEVEL SECURITY;

-- Create policies for patient_pharmacies
CREATE POLICY "Users can view their own pharmacies"
ON public.patient_pharmacies FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own pharmacies"
ON public.patient_pharmacies FOR INSERT
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own pharmacies"
ON public.patient_pharmacies FOR UPDATE
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Ensure patient_emergency_contacts table exists
CREATE TABLE IF NOT EXISTS public.patient_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on patient_emergency_contacts
ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for patient_emergency_contacts
CREATE POLICY "Users can view their own emergency contacts"
ON public.patient_emergency_contacts FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own emergency contacts"
ON public.patient_emergency_contacts FOR INSERT
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own emergency contacts"
ON public.patient_emergency_contacts FOR UPDATE
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);