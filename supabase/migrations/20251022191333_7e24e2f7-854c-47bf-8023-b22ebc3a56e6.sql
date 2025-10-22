-- Create checkout_attestation table for managing order confirmation attestation text
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

-- Create index for faster lookups
CREATE INDEX idx_checkout_attestation_active ON public.checkout_attestation(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.checkout_attestation ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow all authenticated users to read active attestation (for checkout page)
CREATE POLICY "Authenticated users can view active attestation"
  ON public.checkout_attestation
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can update
CREATE POLICY "Admins can update attestation"
  ON public.checkout_attestation
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert
CREATE POLICY "Admins can insert attestation"
  ON public.checkout_attestation
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete attestation"
  ON public.checkout_attestation
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default attestation with current hardcoded text
INSERT INTO public.checkout_attestation (title, subtitle, content, checkbox_text, version, is_active)
VALUES (
  'Medical Attestation Required',
  'Please read and confirm the following statement',
  '- All order(s) are medically necessary
- You have advised the patient(s) of any side effects
- You have seen the patient in person
- You have reviewed their medical record to avoid adverse medical effects',
  'I agree to all of the above.',
  1,
  true
);