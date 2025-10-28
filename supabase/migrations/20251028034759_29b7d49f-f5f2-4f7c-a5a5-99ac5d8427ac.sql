-- Add missing columns to patient_messages
ALTER TABLE patient_messages 
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES profiles(id);

-- Add medical information columns to patient_medical_vault
ALTER TABLE patient_medical_vault
ADD COLUMN IF NOT EXISTS blood_type TEXT,
ADD COLUMN IF NOT EXISTS allergies JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS current_medications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS medical_conditions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS vital_signs JSONB DEFAULT '{}'::jsonb;

-- Add address fields to patient_accounts
ALTER TABLE patient_accounts
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Create storage bucket for patient documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for patient documents
CREATE POLICY "Patients can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'patient-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Patients can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'patient-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Providers can view patient documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-documents' 
  AND EXISTS (
    SELECT 1 FROM patient_accounts pa
    WHERE pa.user_id::text = (storage.foldername(name))[1]
    AND pa.practice_id IN (
      SELECT practice_id FROM providers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Patients can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'patient-documents' AND auth.uid()::text = (storage.foldername(name))[1]);