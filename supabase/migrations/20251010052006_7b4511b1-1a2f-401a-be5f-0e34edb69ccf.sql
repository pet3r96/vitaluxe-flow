-- Repair legacy patient.practice_id values that incorrectly point to provider user_ids
-- and ensure consistency by pointing them to the actual practice_id from providers
-- Idempotent fix: only updates mismatched rows
UPDATE public.patients p
SET practice_id = prov.practice_id
FROM public.providers prov
WHERE p.practice_id = prov.user_id
  AND prov.practice_id IS NOT NULL
  AND (p.practice_id IS DISTINCT FROM prov.practice_id);

-- Add helpful index for practice-scoped patient queries (safe to run repeatedly)
CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON public.patients(practice_id);
