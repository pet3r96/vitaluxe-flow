-- Update patient_accounts status check constraint to include 'disabled'
ALTER TABLE public.patient_accounts
DROP CONSTRAINT IF EXISTS patient_accounts_status_check;

ALTER TABLE public.patient_accounts
ADD CONSTRAINT patient_accounts_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'disabled'::text]));