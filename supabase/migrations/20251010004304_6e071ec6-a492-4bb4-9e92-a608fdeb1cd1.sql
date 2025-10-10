-- Add address verification columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_formatted TEXT,
ADD COLUMN IF NOT EXISTS address_verification_status TEXT DEFAULT 'unverified' CHECK (address_verification_status IN ('verified', 'invalid', 'manual', 'unverified')),
ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS address_verification_source TEXT,

ADD COLUMN IF NOT EXISTS shipping_address_street TEXT,
ADD COLUMN IF NOT EXISTS shipping_address_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_address_state TEXT,
ADD COLUMN IF NOT EXISTS shipping_address_zip TEXT,
ADD COLUMN IF NOT EXISTS shipping_address_formatted TEXT,
ADD COLUMN IF NOT EXISTS shipping_address_verification_status TEXT DEFAULT 'unverified' CHECK (shipping_address_verification_status IN ('verified', 'invalid', 'manual', 'unverified')),
ADD COLUMN IF NOT EXISTS shipping_address_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS shipping_address_verification_source TEXT;

-- Add address verification columns to pharmacies table
ALTER TABLE public.pharmacies
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_formatted TEXT,
ADD COLUMN IF NOT EXISTS address_verification_status TEXT DEFAULT 'unverified' CHECK (address_verification_status IN ('verified', 'invalid', 'manual', 'unverified')),
ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS address_verification_source TEXT;

-- Add address verification columns to patients table
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_formatted TEXT,
ADD COLUMN IF NOT EXISTS address_verification_status TEXT DEFAULT 'unverified' CHECK (address_verification_status IN ('verified', 'invalid', 'manual', 'unverified')),
ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS address_verification_source TEXT;

-- Create indexes for efficient querying of unverified addresses
CREATE INDEX IF NOT EXISTS idx_profiles_address_verification 
ON public.profiles(address_verification_status) 
WHERE address_verification_status != 'verified';

CREATE INDEX IF NOT EXISTS idx_profiles_shipping_verification 
ON public.profiles(shipping_address_verification_status) 
WHERE shipping_address_verification_status != 'verified';

CREATE INDEX IF NOT EXISTS idx_pharmacies_address_verification 
ON public.pharmacies(address_verification_status) 
WHERE address_verification_status != 'verified';

CREATE INDEX IF NOT EXISTS idx_patients_address_verification 
ON public.patients(address_verification_status) 
WHERE address_verification_status != 'verified';