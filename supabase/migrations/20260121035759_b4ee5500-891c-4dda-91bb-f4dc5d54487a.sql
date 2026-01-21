-- Drop the test_prescriber_npi column from pharmacies table
ALTER TABLE public.pharmacies DROP COLUMN IF EXISTS test_prescriber_npi;