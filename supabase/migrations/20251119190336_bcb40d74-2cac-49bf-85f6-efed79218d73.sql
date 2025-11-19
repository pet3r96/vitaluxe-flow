-- ========================================
-- Document Recovery Migration (Fixed)
-- Restores orphaned documents from storage
-- ========================================

-- 1. Create orphan tracking table
CREATE TABLE IF NOT EXISTS orphan_storage_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  storage_created_at timestamptz,
  reason text,
  logged_at timestamptz DEFAULT now()
);

COMMENT ON TABLE orphan_storage_files IS 'Tracks storage files that could not be automatically mapped to database records';

-- 2. Backfill provider_documents from storage.objects (only valid UUIDs)
WITH storage_files AS (
  SELECT
    o.name AS storage_path,
    split_part(o.name, '/', 1) AS practice_folder,
    (o.metadata->>'mimetype') AS mime_type,
    (o.metadata->>'size')::bigint AS file_size,
    o.created_at AS storage_created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'provider-documents'
    -- Only process folders that look like UUIDs
    AND split_part(o.name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
mapped_files AS (
  SELECT
    sf.storage_path,
    sf.mime_type,
    sf.file_size,
    sf.storage_created_at,
    p.id AS practice_id,
    split_part(sf.storage_path, '/', array_length(string_to_array(sf.storage_path, '/'), 1)) AS document_name
  FROM storage_files sf
  JOIN profiles p
    ON p.id = sf.practice_folder::uuid
),
candidates AS (
  SELECT mf.*
  FROM mapped_files mf
  LEFT JOIN provider_documents pd
    ON pd.storage_path = mf.storage_path
  WHERE pd.id IS NULL
)
INSERT INTO provider_documents (
  id,
  practice_id,
  document_name,
  document_type,
  storage_path,
  file_size,
  mime_type,
  status,
  notes,
  created_at,
  uploaded_by
)
SELECT
  gen_random_uuid() AS id,
  c.practice_id,
  COALESCE(NULLIF(c.document_name, ''), 'Recovered Document') AS document_name,
  CASE
    WHEN c.mime_type LIKE 'application/pdf%' THEN 'pdf'
    WHEN c.mime_type LIKE 'image/%' THEN 'image'
    ELSE 'other'
  END AS document_type,
  c.storage_path,
  c.file_size,
  c.mime_type,
  'uploaded'::text AS status,
  'Recovered from storage backfill on ' || now()::date AS notes,
  COALESCE(c.storage_created_at, now()) AS created_at,
  NULL::uuid AS uploaded_by
FROM candidates c;

-- 3. Log unmapped files to orphan table (includes non-UUID folders and non-existent practices)
INSERT INTO orphan_storage_files (bucket_id, storage_path, mime_type, file_size, storage_created_at, reason)
SELECT
  'provider-documents' AS bucket_id,
  o.name AS storage_path,
  (o.metadata->>'mimetype') AS mime_type,
  (o.metadata->>'size')::bigint AS file_size,
  o.created_at,
  CASE
    WHEN split_part(o.name, '/', 1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN 'Invalid UUID format in path: ' || split_part(o.name, '/', 1)
    ELSE 'No matching practice/profile for UUID: ' || split_part(o.name, '/', 1)
  END AS reason
FROM storage.objects o
WHERE o.bucket_id = 'provider-documents'
  AND NOT EXISTS (
    SELECT 1 FROM provider_documents pd WHERE pd.storage_path = o.name
  )
  AND (
    -- Non-UUID folders
    split_part(o.name, '/', 1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR
    -- Valid UUID but no matching profile
    NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.id::text = split_part(o.name, '/', 1)
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM orphan_storage_files osf WHERE osf.storage_path = o.name
  );

-- 4. Backfill patient_documents from patient_medical_vault
WITH vault_docs AS (
  SELECT
    pmv.id AS vault_id,
    pmv.patient_id,
    pmv.record_data->>'document_name' AS document_name,
    pmv.record_data->>'storage_path' AS storage_path,
    (pmv.record_data->>'share_with_practice')::boolean AS share_with_practice,
    pmv.record_data->>'mime_type' AS mime_type,
    (pmv.record_data->>'file_size')::bigint AS file_size,
    pmv.created_at
  FROM patient_medical_vault pmv
  WHERE pmv.record_type = 'document'
),
candidates AS (
  SELECT vd.*
  FROM vault_docs vd
  LEFT JOIN patient_documents pd
    ON pd.storage_path = vd.storage_path
  WHERE pd.id IS NULL
)
INSERT INTO patient_documents (
  id,
  patient_id,
  document_name,
  document_type,
  storage_path,
  file_size,
  mime_type,
  share_with_practice,
  notes,
  created_at,
  uploaded_by
)
SELECT
  gen_random_uuid(),
  c.patient_id,
  COALESCE(NULLIF(c.document_name, ''), 'Recovered Patient Document'),
  CASE
    WHEN c.mime_type LIKE 'application/pdf%' THEN 'pdf'
    WHEN c.mime_type LIKE 'image/%' THEN 'image'
    ELSE 'other'
  END AS document_type,
  c.storage_path,
  c.file_size,
  c.mime_type,
  COALESCE(c.share_with_practice, false),
  'Backfilled from patient_medical_vault on ' || now()::date,
  COALESCE(c.created_at, now()),
  NULL::uuid AS uploaded_by
FROM candidates c;