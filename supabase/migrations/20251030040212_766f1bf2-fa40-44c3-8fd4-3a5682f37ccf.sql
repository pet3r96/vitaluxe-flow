-- Create patient medications table
CREATE TABLE IF NOT EXISTS public.patient_medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  start_date DATE,
  stop_date DATE,
  notes TEXT,
  instructions TEXT,
  associated_condition_id UUID,
  prescribing_provider_id UUID,
  alert_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient conditions table
CREATE TABLE IF NOT EXISTS public.patient_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  description TEXT,
  icd10_code TEXT,
  date_diagnosed DATE,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  treatment_plan TEXT,
  associated_provider_id UUID,
  notes TEXT,
  attachments JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient allergies table
CREATE TABLE IF NOT EXISTS public.patient_allergies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  nka BOOLEAN DEFAULT false,
  allergen_name TEXT,
  reaction_type TEXT,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  date_recorded DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient vitals table
CREATE TABLE IF NOT EXISTS public.patient_vitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  height NUMERIC,
  height_unit TEXT DEFAULT 'in',
  weight NUMERIC,
  weight_unit TEXT DEFAULT 'lbs',
  bmi NUMERIC,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  pulse INTEGER,
  temperature NUMERIC,
  temperature_unit TEXT DEFAULT 'F',
  oxygen_saturation INTEGER,
  cholesterol NUMERIC,
  blood_sugar NUMERIC,
  additional_vitals JSONB,
  date_recorded TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient immunizations table
CREATE TABLE IF NOT EXISTS public.patient_immunizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_administered DATE NOT NULL,
  lot_number TEXT,
  administering_provider TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient surgeries table
CREATE TABLE IF NOT EXISTS public.patient_surgeries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  surgery_type TEXT NOT NULL,
  surgery_date DATE NOT NULL,
  surgeon_name TEXT,
  hospital TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient pharmacies table
CREATE TABLE IF NOT EXISTS public.patient_pharmacies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  pharmacy_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient emergency contacts table
CREATE TABLE IF NOT EXISTS public.patient_emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  contact_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add gender_at_birth to patient_accounts if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_accounts' AND column_name = 'gender_at_birth') THEN
    ALTER TABLE public.patient_accounts ADD COLUMN gender_at_birth TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_accounts' AND column_name = 'primary_provider_id') THEN
    ALTER TABLE public.patient_accounts ADD COLUMN primary_provider_id UUID;
  END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_immunizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for patient_medications
CREATE POLICY "Patients can view their own medications"
ON public.patient_medications FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own medications"
ON public.patient_medications FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create policies for patient_conditions
CREATE POLICY "Patients can view their own conditions"
ON public.patient_conditions FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own conditions"
ON public.patient_conditions FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create policies for patient_allergies
CREATE POLICY "Patients can view their own allergies"
ON public.patient_allergies FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own allergies"
ON public.patient_allergies FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create policies for patient_vitals
CREATE POLICY "Patients can view their own vitals"
ON public.patient_vitals FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own vitals"
ON public.patient_vitals FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create policies for patient_immunizations
CREATE POLICY "Patients can view their own immunizations"
ON public.patient_immunizations FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own immunizations"
ON public.patient_immunizations FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create policies for patient_surgeries
CREATE POLICY "Patients can view their own surgeries"
ON public.patient_surgeries FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own surgeries"
ON public.patient_surgeries FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create policies for patient_pharmacies
CREATE POLICY "Patients can view their own pharmacies"
ON public.patient_pharmacies FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own pharmacies"
ON public.patient_pharmacies FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create policies for patient_emergency_contacts
CREATE POLICY "Patients can view their own emergency contacts"
ON public.patient_emergency_contacts FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients can manage their own emergency contacts"
ON public.patient_emergency_contacts FOR ALL
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_account_id ON public.patient_medications(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient_account_id ON public.patient_conditions(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient_account_id ON public.patient_allergies(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_account_id ON public.patient_vitals(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patient_immunizations_patient_account_id ON public.patient_immunizations(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patient_surgeries_patient_account_id ON public.patient_surgeries(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patient_pharmacies_patient_account_id ON public.patient_pharmacies(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_patient_emergency_contacts_patient_account_id ON public.patient_emergency_contacts(patient_account_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_medications_updated_at BEFORE UPDATE ON public.patient_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_conditions_updated_at BEFORE UPDATE ON public.patient_conditions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_allergies_updated_at BEFORE UPDATE ON public.patient_allergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_vitals_updated_at BEFORE UPDATE ON public.patient_vitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_immunizations_updated_at BEFORE UPDATE ON public.patient_immunizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_surgeries_updated_at BEFORE UPDATE ON public.patient_surgeries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_pharmacies_updated_at BEFORE UPDATE ON public.patient_pharmacies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_emergency_contacts_updated_at BEFORE UPDATE ON public.patient_emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();