-- Drop the non-partial unique constraint that blocks NULL user_id inserts
ALTER TABLE public.patient_accounts
  DROP CONSTRAINT IF EXISTS patient_accounts_user_id_key;

-- Drop redundant regular index (partial unique index already covers lookups)
DROP INDEX IF EXISTS idx_patient_accounts_user_id;