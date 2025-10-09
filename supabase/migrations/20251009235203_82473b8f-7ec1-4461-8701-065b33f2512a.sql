-- Phase 2: Add shipping columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_preference TEXT DEFAULT 'patient_drop';

-- Add constraint for shipping_preference
ALTER TABLE public.profiles
ADD CONSTRAINT shipping_preference_check 
CHECK (shipping_preference IN ('office', 'patient_drop'));

-- Phase 3: Add fulfillment columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS ship_to TEXT DEFAULT 'patient',
ADD COLUMN IF NOT EXISTS practice_address TEXT;

-- Add constraint for ship_to
ALTER TABLE public.orders
ADD CONSTRAINT ship_to_check 
CHECK (ship_to IN ('patient', 'practice'));