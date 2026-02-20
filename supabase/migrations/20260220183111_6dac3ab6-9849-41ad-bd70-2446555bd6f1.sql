-- Bug 1: Scope email uniqueness per practice instead of globally
DROP INDEX IF EXISTS patient_accounts_email_lower_unique;
CREATE UNIQUE INDEX patient_accounts_practice_email_unique 
  ON public.patient_accounts (practice_id, lower(email)) 
  WHERE email IS NOT NULL;