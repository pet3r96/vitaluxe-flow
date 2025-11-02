-- Add tracking columns to all medical vault tables
-- This allows us to track WHO added each entry (patient vs practice staff)

-- Add to patient_medications
ALTER TABLE patient_medications 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));

-- Add to patient_allergies
ALTER TABLE patient_allergies 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));

-- Add to patient_conditions
ALTER TABLE patient_conditions 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));

-- Add to patient_surgeries
ALTER TABLE patient_surgeries 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));

-- Add to patient_immunizations
ALTER TABLE patient_immunizations 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));

-- Add to patient_pharmacies
ALTER TABLE patient_pharmacies 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));

-- Add to patient_emergency_contacts
ALTER TABLE patient_emergency_contacts 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));

-- Add to patient_vitals
ALTER TABLE patient_vitals 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS added_by_role TEXT CHECK (added_by_role IN ('patient', 'provider', 'staff', 'doctor'));