-- Phase 1.4: Add hidden_by_patient column to patient_documents
ALTER TABLE public.patient_documents
ADD COLUMN IF NOT EXISTS hidden_by_patient BOOLEAN NOT NULL DEFAULT false;

-- Add index for filtering by hidden status
CREATE INDEX IF NOT EXISTS idx_patient_documents_hidden
ON public.patient_documents(patient_id, hidden_by_patient) 
WHERE hidden_by_patient = false;