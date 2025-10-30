-- Add patient_account_id link column to patients table
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS patient_account_id UUID REFERENCES public.patient_accounts(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_patient_account_id ON public.patients(patient_account_id);

-- Try to auto-link existing records by matching practice_id + email
UPDATE public.patients p
SET patient_account_id = pa.id
FROM public.patient_accounts pa
WHERE p.practice_id = pa.practice_id 
  AND LOWER(TRIM(p.email)) = LOWER(TRIM(pa.email))
  AND p.patient_account_id IS NULL
  AND p.email IS NOT NULL
  AND p.email != '';

-- Comment for tracking
COMMENT ON COLUMN public.patients.patient_account_id IS 'Links practice patient record to patient portal account';