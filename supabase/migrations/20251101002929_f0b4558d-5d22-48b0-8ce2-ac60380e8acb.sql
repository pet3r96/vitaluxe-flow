-- Backfill NULL practice_id in patient_accounts using provider's practice_id
-- This ensures all patients are associated with a practice

UPDATE patient_accounts pa
SET practice_id = p.practice_id
FROM providers p
WHERE pa.practice_id IS NULL
  AND pa.provider_id IS NOT NULL
  AND pa.provider_id = p.id
  AND p.practice_id IS NOT NULL;