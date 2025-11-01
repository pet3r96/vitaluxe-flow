-- Create medical vault share links table for one-time access
CREATE TABLE public.medical_vault_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  accessed_by_ip TEXT NULL,
  consent_agreed_at TIMESTAMPTZ NOT NULL,
  consent_ip TEXT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL
);

-- Index for fast token lookup
CREATE INDEX idx_share_links_token ON public.medical_vault_share_links(token) WHERE used_at IS NULL AND is_revoked = FALSE;

-- Index for cleanup queries
CREATE INDEX idx_share_links_expires_at ON public.medical_vault_share_links(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.medical_vault_share_links ENABLE ROW LEVEL SECURITY;

-- Patients can create links for their own records
CREATE POLICY "Patients can create their own share links"
  ON public.medical_vault_share_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
    )
  );

-- Patients can view their own share links
CREATE POLICY "Patients can view their own share links"
  ON public.medical_vault_share_links
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()
    )
  );

-- Admins can view all share links for audit purposes
CREATE POLICY "Admins can view all share links"
  ON public.medical_vault_share_links
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));