
-- Add suite/apt columns to all address tables (all nullable, never required)

-- profiles table (practice address + shipping address)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_suite TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shipping_address_suite TEXT;

-- patient_accounts table
ALTER TABLE public.patient_accounts ADD COLUMN IF NOT EXISTS address_suite TEXT;

-- pharmacies table
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS address_suite TEXT;
