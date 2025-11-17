-- Create checkout_attestation table for order confirmation page
CREATE TABLE IF NOT EXISTS public.checkout_attestation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL,
  checkbox_text TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.checkout_attestation ENABLE ROW LEVEL SECURITY;

-- Admins can manage all attestations
CREATE POLICY "Admins can manage all attestations"
  ON public.checkout_attestation
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Anyone can view active attestation (for checkout page)
CREATE POLICY "Anyone can view active attestation"
  ON public.checkout_attestation
  FOR SELECT
  USING (is_active = true);

-- Create index for active attestation lookup
CREATE INDEX idx_checkout_attestation_active ON public.checkout_attestation(is_active) WHERE is_active = true;

-- Insert default checkout attestation
INSERT INTO public.checkout_attestation (title, subtitle, content, checkbox_text, version, is_active)
VALUES (
  'Medical Attestation Required',
  'Please read and confirm the following statement',
  '- I confirm that all patient information provided is accurate and complete
- I understand that this is a prescription medication order
- I have obtained proper authorization to place this order
- I agree to VitaLuxe terms of service',
  'I agree to all of the above',
  1,
  true
);