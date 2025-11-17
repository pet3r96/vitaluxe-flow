-- Create patient_portal_terms table
CREATE TABLE IF NOT EXISTS public.patient_portal_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.patient_portal_terms ENABLE ROW LEVEL SECURITY;

-- Admins can manage all patient portal terms
CREATE POLICY "Admins can manage patient portal terms"
  ON public.patient_portal_terms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Patients can view active patient portal terms
CREATE POLICY "Patients can view active portal terms"
  ON public.patient_portal_terms
  FOR SELECT
  USING (is_active = true);

-- Insert default patient portal terms
INSERT INTO public.patient_portal_terms (title, content, version, is_active)
VALUES (
  'Patient Portal Terms and Conditions',
  E'# Patient Portal Terms and Conditions\n\n## 1. Acceptance of Terms\n\nBy accessing and using the VitaLuxe Patient Portal, you agree to be bound by these Terms and Conditions.\n\n## 2. Portal Access\n\nYou are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.\n\n## 3. Medical Information\n\nThe information provided through this portal is for informational purposes only and does not constitute medical advice.\n\n## 4. Privacy and Security\n\nWe are committed to protecting your personal health information in accordance with HIPAA regulations.\n\n## 5. Prohibited Uses\n\nYou may not use the portal for any unlawful purpose or in any way that could damage, disable, or impair the service.',
  1,
  true
)
ON CONFLICT DO NOTHING;