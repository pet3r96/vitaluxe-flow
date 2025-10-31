-- Add missing columns to patient_accounts table
ALTER TABLE public.patient_accounts 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_formatted TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS address_verification_status TEXT,
ADD COLUMN IF NOT EXISTS address_verification_source TEXT,
ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS provider_id UUID,
ADD COLUMN IF NOT EXISTS gender_at_birth TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Create index on practice_id for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_accounts_practice_id ON public.patient_accounts(practice_id);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_patient_accounts_email ON public.patient_accounts(email);