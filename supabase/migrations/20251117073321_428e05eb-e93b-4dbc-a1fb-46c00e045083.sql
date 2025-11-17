-- Create provider_documents table with dual-provider support
CREATE TABLE IF NOT EXISTS public.provider_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_provider TEXT DEFAULT 's3' CHECK (storage_provider IN ('s3', 'supabase')),
  file_size BIGINT,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create provider_document_assignments table
CREATE TABLE IF NOT EXISTS public.provider_document_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES provider_documents(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(document_id, patient_id)
);

-- Enable RLS
ALTER TABLE public.provider_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_document_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for provider_documents
CREATE POLICY "Practices can manage their own documents"
ON public.provider_documents
FOR ALL
USING (
  auth.uid() = practice_id OR
  EXISTS (
    SELECT 1 FROM providers 
    WHERE providers.user_id = auth.uid() 
    AND providers.practice_id = provider_documents.practice_id
  ) OR
  EXISTS (
    SELECT 1 FROM practice_staff
    WHERE practice_staff.user_id = auth.uid()
    AND practice_staff.practice_id = provider_documents.practice_id
  )
);

-- RLS policies for provider_document_assignments
CREATE POLICY "Practice members can view and manage assignments"
ON public.provider_document_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM provider_documents pd
    WHERE pd.id = provider_document_assignments.document_id
    AND (
      auth.uid() = pd.practice_id OR
      EXISTS (
        SELECT 1 FROM providers 
        WHERE providers.user_id = auth.uid() 
        AND providers.practice_id = pd.practice_id
      ) OR
      EXISTS (
        SELECT 1 FROM practice_staff
        WHERE practice_staff.user_id = auth.uid()
        AND practice_staff.practice_id = pd.practice_id
      )
    )
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_provider_documents_practice_id ON provider_documents(practice_id);
CREATE INDEX IF NOT EXISTS idx_provider_documents_storage_provider ON provider_documents(storage_provider);
CREATE INDEX IF NOT EXISTS idx_provider_document_assignments_document_id ON provider_document_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_provider_document_assignments_patient_id ON provider_document_assignments(patient_id);

-- Create Supabase Storage buckets for fallback
INSERT INTO storage.buckets (id, name, public) 
VALUES ('provider-documents', 'provider-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for provider-documents bucket
CREATE POLICY "Practice members can upload provider documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'provider-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM profiles WHERE id = auth.uid()
    UNION
    SELECT practice_id::text FROM providers WHERE user_id = auth.uid()
    UNION
    SELECT practice_id::text FROM practice_staff WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Practice members can view provider documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'provider-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM profiles WHERE id = auth.uid()
    UNION
    SELECT practice_id::text FROM providers WHERE user_id = auth.uid()
    UNION
    SELECT practice_id::text FROM practice_staff WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Practice members can delete provider documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'provider-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM profiles WHERE id = auth.uid()
    UNION
    SELECT practice_id::text FROM providers WHERE user_id = auth.uid()
    UNION
    SELECT practice_id::text FROM practice_staff WHERE user_id = auth.uid()
  )
);

-- Storage RLS policies for patient-documents bucket
CREATE POLICY "Patients can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'patient-documents' AND
  (storage.foldername(name))[1] = (
    SELECT id::text FROM patient_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patients and practice can view patient documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'patient-documents' AND
  (
    (storage.foldername(name))[1] = (
      SELECT id::text FROM patient_accounts WHERE user_id = auth.uid()
    )
    OR
    (storage.foldername(name))[1] IN (
      SELECT pa.id::text FROM patient_accounts pa
      WHERE pa.practice_id = auth.uid()
      OR pa.practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
      OR pa.practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid())
    )
  )
);
