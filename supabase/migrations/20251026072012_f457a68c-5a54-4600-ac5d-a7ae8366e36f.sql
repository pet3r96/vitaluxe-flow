-- Create practice_development_fees table
CREATE TABLE practice_development_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topline_rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  monthly_amount NUMERIC(10,2) NOT NULL CHECK (monthly_amount > 0),
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_practice_dev_fees_topline ON practice_development_fees(topline_rep_id);
CREATE INDEX idx_practice_dev_fees_active ON practice_development_fees(active);

-- Enable RLS
ALTER TABLE practice_development_fees ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to practice_development_fees"
ON practice_development_fees FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Topline reps can view their own fees
CREATE POLICY "Topline reps view own fees"
ON practice_development_fees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reps 
    WHERE reps.id = practice_development_fees.topline_rep_id 
    AND reps.user_id = auth.uid()
  )
);

-- Create practice_development_fee_invoices table
CREATE TABLE practice_development_fee_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  topline_rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  billing_month DATE NOT NULL,
  invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  payment_notes TEXT,
  invoice_template_data JSONB NOT NULL,
  pdf_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_pdf_invoices_rep ON practice_development_fee_invoices(topline_rep_id);
CREATE INDEX idx_pdf_invoices_status ON practice_development_fee_invoices(payment_status);
CREATE INDEX idx_pdf_invoices_billing_month ON practice_development_fee_invoices(billing_month);

-- Enable RLS
ALTER TABLE practice_development_fee_invoices ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to pdf invoices"
ON practice_development_fee_invoices FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Topline reps view their own invoices
CREATE POLICY "Topline reps view own invoices"
ON practice_development_fee_invoices FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reps 
    WHERE reps.id = practice_development_fee_invoices.topline_rep_id 
    AND reps.user_id = auth.uid()
  )
);

-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('practice-development-invoices', 'practice-development-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoice PDFs
CREATE POLICY "Admins can manage invoice PDFs"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'practice-development-invoices' 
  AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  bucket_id = 'practice-development-invoices' 
  AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Topline reps can view own invoice PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'practice-development-invoices'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM reps WHERE user_id = auth.uid()
  )
);