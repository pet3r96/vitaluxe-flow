-- Add test_prescriber_npi column to pharmacies table
ALTER TABLE public.pharmacies 
ADD COLUMN IF NOT EXISTS test_prescriber_npi text;

COMMENT ON COLUMN public.pharmacies.test_prescriber_npi IS 
  'NPI number for the test prescriber used when sending test orders to VIOS. Must be registered with the pharmacy VIOS account.';