-- Create junction table for document-patient assignments (many-to-many)
CREATE TABLE IF NOT EXISTS public.provider_document_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.provider_documents(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id, patient_id)
);

-- Enable RLS
ALTER TABLE public.provider_document_patients ENABLE ROW LEVEL SECURITY;

-- Practices can manage their own document-patient assignments
CREATE POLICY "Practices can manage their document assignments"
ON public.provider_document_patients
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.provider_documents pd
    WHERE pd.id = provider_document_patients.document_id
    AND pd.practice_id = auth.uid()
  )
);

-- Admins can view all
CREATE POLICY "Admins can view all document assignments"
ON public.provider_document_patients
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Patients can view documents assigned to them
CREATE POLICY "Patients can view their assigned documents"
ON public.provider_document_patients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patient_accounts pa
    WHERE pa.id = provider_document_patients.patient_id
    AND pa.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_doc_patients_document_id ON public.provider_document_patients(document_id);
CREATE INDEX idx_doc_patients_patient_id ON public.provider_document_patients(patient_id);

-- Migrate existing assigned_patient_id values to new junction table
INSERT INTO public.provider_document_patients (document_id, patient_id, assigned_at, assigned_by)
SELECT id, assigned_patient_id, created_at, practice_id
FROM public.provider_documents
WHERE assigned_patient_id IS NOT NULL
ON CONFLICT (document_id, patient_id) DO NOTHING;

-- Add comment to deprecated column
COMMENT ON COLUMN public.provider_documents.assigned_patient_id IS 'DEPRECATED: Use provider_document_patients junction table instead';

-- Add table comment
COMMENT ON TABLE public.provider_document_patients IS 'Junction table for many-to-many relationship between documents and patients';