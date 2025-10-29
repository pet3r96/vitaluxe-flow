-- Switch FK target without altering column type due to policy dependency
BEGIN;

ALTER TABLE public.patient_follow_ups
  DROP CONSTRAINT IF EXISTS patient_follow_ups_patient_id_fkey;

ALTER TABLE public.patient_follow_ups
  ADD CONSTRAINT patient_follow_ups_patient_id_fkey
  FOREIGN KEY (patient_id)
  REFERENCES public.patient_accounts(id)
  ON DELETE CASCADE;

COMMIT;