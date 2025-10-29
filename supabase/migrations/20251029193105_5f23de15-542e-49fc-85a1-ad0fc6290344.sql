-- Create patient_terms_acceptances table for patient portal terms
CREATE TABLE IF NOT EXISTS public.patient_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_id uuid NOT NULL,
  terms_version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT NOW(),
  signature_name text NOT NULL,
  signed_pdf_url text,
  ip_address text,
  user_agent text,
  UNIQUE(user_id, terms_id)
);

-- Enable RLS
ALTER TABLE public.patient_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own acceptances
CREATE POLICY "Users can view own acceptances"
  ON public.patient_terms_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: System can insert acceptances (via service role in edge function)
CREATE POLICY "Service role can insert acceptances"
  ON public.patient_terms_acceptances
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_patient_terms_acceptances_user_id ON public.patient_terms_acceptances(user_id);