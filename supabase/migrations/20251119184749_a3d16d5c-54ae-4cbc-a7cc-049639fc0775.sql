-- PHASE 1: Create missing patient_documents table
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  notes text,
  share_with_practice boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  storage_provider text DEFAULT 'supabase',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_share ON patient_documents(patient_id, share_with_practice) WHERE share_with_practice = true;

-- Enable RLS
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Patients own their docs
CREATE POLICY "patient_owns_docs" ON patient_documents FOR ALL
USING (patient_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid()))
WITH CHECK (patient_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid()));

-- RLS Policy 2: Practice/staff can view shared docs
CREATE POLICY "practice_sees_shared_docs" ON patient_documents FOR SELECT
USING (
  share_with_practice = true
  AND patient_id IN (
    SELECT pa.id FROM patient_accounts pa
    WHERE pa.practice_id = auth.uid()
       OR pa.practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
       OR pa.practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid() AND active = true)
  )
);

-- PHASE 2: Add missing columns to existing tables
ALTER TABLE provider_documents ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id);
ALTER TABLE provider_documents ADD COLUMN IF NOT EXISTS status text DEFAULT 'uploaded';
ALTER TABLE provider_documents ADD COLUMN IF NOT EXISTS assigned_patient_id uuid REFERENCES patient_accounts(id);
ALTER TABLE provider_document_assignments ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- PHASE 3: Replace broken RPC function
DROP FUNCTION IF EXISTS get_provider_documents(uuid);

CREATE FUNCTION get_provider_documents(p_practice_id uuid)
RETURNS TABLE(
  id uuid,
  source_type text,
  document_name text,
  document_type text,
  uploaded_at timestamptz,
  uploaded_by uuid,
  file_size bigint,
  mime_type text,
  notes text,
  storage_path text,
  assigned_patient_ids uuid[],
  assigned_patient_names text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH practice_docs AS (
    SELECT
      pd.id,
      'practice'::text AS source_type,
      pd.document_name,
      pd.document_type,
      pd.created_at AS uploaded_at,
      pd.uploaded_by,
      pd.file_size,
      pd.mime_type,
      pd.notes,
      pd.storage_path,
      ARRAY_REMOVE(ARRAY_AGG(pda.patient_id), NULL) AS assigned_patient_ids,
      ARRAY_REMOVE(ARRAY_AGG(pa.first_name || ' ' || pa.last_name), NULL) AS assigned_patient_names
    FROM provider_documents pd
    LEFT JOIN provider_document_assignments pda ON pd.id = pda.document_id
    LEFT JOIN patient_accounts pa ON pda.patient_id = pa.id
    WHERE pd.practice_id = p_practice_id
    GROUP BY pd.id
  ),
  patient_shared_docs AS (
    SELECT
      pat_doc.id,
      'patient_shared'::text AS source_type,
      pat_doc.document_name,
      pat_doc.document_type,
      pat_doc.created_at AS uploaded_at,
      pat_doc.uploaded_by,
      pat_doc.file_size,
      pat_doc.mime_type,
      pat_doc.notes,
      pat_doc.storage_path,
      ARRAY[pat_acct.id] AS assigned_patient_ids,
      ARRAY[pat_acct.first_name || ' ' || pat_acct.last_name] AS assigned_patient_names
    FROM patient_documents pat_doc
    JOIN patient_accounts pat_acct ON pat_doc.patient_id = pat_acct.id
    WHERE pat_acct.practice_id = p_practice_id
      AND pat_doc.share_with_practice = true
  )
  SELECT * FROM practice_docs
  UNION ALL
  SELECT * FROM patient_shared_docs
  ORDER BY uploaded_at DESC;
$$;