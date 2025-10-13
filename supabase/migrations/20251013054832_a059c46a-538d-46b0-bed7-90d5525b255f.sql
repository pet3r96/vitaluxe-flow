-- Create terms_and_conditions table for master templates
CREATE TABLE public.terms_and_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Index for quick role lookup
CREATE INDEX idx_terms_role ON public.terms_and_conditions(role);

-- RLS Policies for terms_and_conditions
ALTER TABLE public.terms_and_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view terms" ON public.terms_and_conditions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage terms" ON public.terms_and_conditions
  FOR ALL TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create user_terms_acceptances table for signatures
CREATE TABLE public.user_terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_id UUID NOT NULL REFERENCES public.terms_and_conditions(id),
  role app_role NOT NULL,
  terms_version INTEGER NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  signature_name TEXT NOT NULL,
  signed_pdf_url TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE(user_id, terms_id)
);

-- Indexes for user_terms_acceptances
CREATE INDEX idx_acceptances_user ON public.user_terms_acceptances(user_id);
CREATE INDEX idx_acceptances_role ON public.user_terms_acceptances(role);

-- RLS Policies for user_terms_acceptances
ALTER TABLE public.user_terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own acceptances" ON public.user_terms_acceptances
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own acceptances" ON public.user_terms_acceptances
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all acceptances" ON public.user_terms_acceptances
  FOR SELECT TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add terms_accepted column to user_password_status
ALTER TABLE public.user_password_status 
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;

-- Update existing records
UPDATE public.user_password_status 
SET terms_accepted = FALSE 
WHERE terms_accepted IS NULL;

-- Create storage bucket for signed terms PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('terms-signed', 'terms-signed', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage bucket - users can upload their own signed terms
CREATE POLICY "Users can upload their own signed terms"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'terms-signed' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can access all signed terms
CREATE POLICY "Admins can access all signed terms"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'terms-signed' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Users can view their own signed terms
CREATE POLICY "Users can view own signed terms"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'terms-signed' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Seed initial terms for each role
INSERT INTO public.terms_and_conditions (role, title, content, version) VALUES
('doctor', 'Practice Terms and Conditions', 
'# PRACTICE TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS
By accessing and using VitaLuxe services as a practice owner, you agree to be bound by these Terms and Conditions.

## 2. PRACTICE RESPONSIBILITIES
- Maintain valid medical licenses and certifications
- Ensure all patient information is accurate and up-to-date
- Comply with HIPAA and all applicable healthcare regulations
- Maintain professional liability insurance

## 3. ORDERING AND PRESCRIPTIONS
- Only prescribe medications within your scope of practice
- Ensure all prescriptions are medically necessary
- Review and approve all orders before submission
- Maintain proper prescription documentation

## 4. PAYMENT TERMS
- Payment is due upon order placement
- All pricing is subject to change with notice
- Refunds are subject to our refund policy

## 5. COMPLIANCE
- Maintain compliance with all federal and state regulations
- Report any adverse events or product issues
- Cooperate with any audits or investigations

## 6. TERMINATION
VitaLuxe reserves the right to terminate this agreement for violations of these terms.

## 7. LIMITATION OF LIABILITY
VitaLuxe shall not be liable for indirect, incidental, or consequential damages.

By signing below, you acknowledge that you have read, understood, and agree to these terms.', 1),

('provider', 'Provider Terms and Conditions',
'# PROVIDER TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS
By accessing and using VitaLuxe services as a healthcare provider, you agree to be bound by these Terms and Conditions.

## 2. PROVIDER RESPONSIBILITIES
- Maintain valid medical licenses and certifications
- Practice within your scope of practice
- Ensure patient safety at all times
- Comply with HIPAA and all applicable regulations

## 3. PRESCRIPTION AUTHORITY
- Only prescribe medications you are authorized to prescribe
- Conduct appropriate patient evaluations
- Document all patient interactions properly
- Report adverse events immediately

## 4. PROFESSIONAL CONDUCT
- Maintain professional standards of care
- Respect patient confidentiality
- Provide accurate and truthful information
- Cooperate with practice policies and procedures

## 5. COMPLIANCE
- Maintain compliance with all federal and state regulations
- Complete required continuing education
- Maintain professional liability insurance
- Report any changes to licensure status

## 6. TERMINATION
Your access may be terminated for violations of these terms or professional misconduct.

## 7. LIMITATION OF LIABILITY
VitaLuxe shall not be liable for indirect, incidental, or consequential damages.

By signing below, you acknowledge that you have read, understood, and agree to these terms.', 1),

('topline', 'Topline Representative Terms and Conditions',
'# TOPLINE REPRESENTATIVE TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS
By joining VitaLuxe as a Topline Representative, you agree to be bound by these Terms and Conditions.

## 2. REPRESENTATIVE RESPONSIBILITIES
- Recruit and manage downline representatives
- Build and maintain practice relationships
- Provide support to your downline team
- Maintain professional conduct at all times

## 3. COMMISSION STRUCTURE
- Commission rates are set by VitaLuxe and subject to change
- Commissions are calculated based on order volume
- Payment terms are net 30 days
- Accurate reporting is required for commission payment

## 4. PRACTICE RECRUITMENT
- Provide accurate information to potential practices
- Comply with all marketing guidelines
- Maintain professional relationships
- Report all new practice sign-ups accurately

## 5. COMPLIANCE
- Comply with all applicable laws and regulations
- Maintain confidentiality of business information
- Avoid conflicts of interest
- Report any compliance concerns immediately

## 6. TERMINATION
- Either party may terminate with 30 days notice
- VitaLuxe may terminate immediately for cause
- Outstanding commissions will be paid per policy
- Non-compete terms may apply

## 7. LIMITATION OF LIABILITY
VitaLuxe shall not be liable for indirect, incidental, or consequential damages.

By signing below, you acknowledge that you have read, understood, and agree to these terms.', 1),

('downline', 'Downline Representative Terms and Conditions',
'# DOWNLINE REPRESENTATIVE TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS
By joining VitaLuxe as a Downline Representative, you agree to be bound by these Terms and Conditions.

## 2. REPRESENTATIVE RESPONSIBILITIES
- Build and maintain practice relationships
- Support practices with product information
- Process practice requests professionally
- Maintain accurate records of all activities

## 3. COMMISSION STRUCTURE
- Commission rates are set by VitaLuxe and subject to change
- Commissions are calculated based on order volume
- Payment terms are net 30 days
- You report to your assigned Topline Representative

## 4. PRACTICE RELATIONSHIPS
- Provide accurate product and service information
- Respond to practice inquiries promptly
- Maintain professional conduct at all times
- Report practice feedback and concerns

## 5. COMPLIANCE
- Comply with all applicable laws and regulations
- Maintain confidentiality of business information
- Follow VitaLuxe policies and procedures
- Complete required training

## 6. TERMINATION
- Either party may terminate with 30 days notice
- VitaLuxe may terminate immediately for cause
- Outstanding commissions will be paid per policy
- Return of company materials may be required

## 7. LIMITATION OF LIABILITY
VitaLuxe shall not be liable for indirect, incidental, or consequential damages.

By signing below, you acknowledge that you have read, understood, and agree to these terms.', 1),

('pharmacy', 'Pharmacy Terms and Conditions',
'# PHARMACY TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS
By accessing and using VitaLuxe services as a pharmacy partner, you agree to be bound by these Terms and Conditions.

## 2. PHARMACY RESPONSIBILITIES
- Maintain valid pharmacy licenses in all service states
- Comply with all federal and state pharmacy regulations
- Maintain appropriate inventory levels
- Provide accurate and timely order fulfillment

## 3. ORDER FULFILLMENT
- Process orders within agreed timeframes
- Ensure accurate medication dispensing
- Maintain proper storage conditions
- Provide tracking information for all shipments

## 4. QUALITY ASSURANCE
- Source medications from approved suppliers only
- Maintain proper handling procedures
- Report any product quality issues immediately
- Maintain proper documentation and records

## 5. COMPLIANCE
- Comply with DEA regulations for controlled substances
- Maintain HIPAA compliance for patient information
- Report adverse events as required
- Cooperate with audits and inspections

## 6. PAYMENT TERMS
- Payment terms as agreed in partner agreement
- Accurate invoicing is required
- Dispute resolution process applies
- Late payments may affect partnership status

## 7. TERMINATION
VitaLuxe reserves the right to terminate this agreement for violations of these terms.

## 8. LIMITATION OF LIABILITY
VitaLuxe shall not be liable for indirect, incidental, or consequential damages.

By signing below, you acknowledge that you have read, understood, and agree to these terms.', 1)
ON CONFLICT (role) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_terms_updated_at
  BEFORE UPDATE ON public.terms_and_conditions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();